import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import crypto from "crypto"
import { lemlistWebhookSchema } from "../_schemas"

const LEMLIST_SECRET = process.env.LEMLIST_WEBHOOK_SECRET ?? ""

/**
 * Verify webhook authenticity using two methods:
 *
 * 1. HMAC-SHA256 signature — Lemlist (or a proxy like Hookdeck) signs the
 *    raw body with the shared secret and sends the hex digest in one of
 *    several common headers.  We check all known header names.
 *
 * 2. Static shared secret — our own X-Webhook-Secret header, a simple
 *    string comparison fallback.
 *
 * If no secret is configured (LEMLIST_WEBHOOK_SECRET is empty), all
 * requests are accepted (dev mode).
 */
function verifySignature(
  headers: Headers,
  rawBody: string,
): { ok: boolean; method: string } {
  // If no secret configured, skip validation (dev/test)
  if (!LEMLIST_SECRET) {
    return { ok: true, method: "no_secret_configured" }
  }

  // ── Method 1: HMAC-SHA256 signature headers ──
  // Lemlist and common webhook proxies may use any of these
  const signatureHeaders = [
    "x-hook-signature",
    "x-hook-secret",
    "x-lemlist-signature",
    "x-signature",
    "x-hub-signature-256",
  ]

  for (const headerName of signatureHeaders) {
    const headerValue = headers.get(headerName)
    if (!headerValue) continue

    // Strip optional "sha256=" prefix (GitHub-style)
    const receivedSig = headerValue.replace(/^sha256=/, "")

    const expectedSig = crypto
      .createHmac("sha256", LEMLIST_SECRET)
      .update(rawBody, "utf8")
      .digest("hex")

    // Constant-time comparison to prevent timing attacks
    try {
      const a = Buffer.from(receivedSig, "hex")
      const b = Buffer.from(expectedSig, "hex")
      if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
        return { ok: true, method: `hmac:${headerName}` }
      }
    } catch {
      // Buffer length mismatch or invalid hex — try base64 encoding
      try {
        const expectedB64 = crypto
          .createHmac("sha256", LEMLIST_SECRET)
          .update(rawBody, "utf8")
          .digest("base64")
        if (receivedSig === expectedB64) {
          return { ok: true, method: `hmac_b64:${headerName}` }
        }
      } catch {
        // Invalid encoding, continue to next header
      }
    }
  }

  // ── Method 2: Static shared secret (our custom header) ──
  const staticSecret = headers.get("x-webhook-secret")
  if (staticSecret && staticSecret === LEMLIST_SECRET) {
    return { ok: true, method: "static_secret" }
  }

  return { ok: false, method: "none" }
}

// ── POST /api/webhooks/lemlist ──
export async function POST(request: Request) {
  // Fail-closed: refuse to process if secret is not configured
  if (!process.env.LEMLIST_WEBHOOK_SECRET) {
    console.error("[webhooks/lemlist] LEMLIST_WEBHOOK_SECRET is not defined. Webhook cannot be verified.")
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 },
    )
  }

  // Read raw body first (needed for HMAC verification before parsing)
  const rawBody = await request.text()

  const { ok: verified, method } = verifySignature(request.headers, rawBody)

  if (!verified) {
    console.error(
      "[Lemlist Webhook] 401 — signature verification failed.",
      "Headers received:",
      Object.fromEntries(
        [...request.headers.entries()].filter(
          ([k]) => k.startsWith("x-") || k === "content-type",
        ),
      ),
    )
    return NextResponse.json(
      { error: "Unauthorized — invalid webhook signature" },
      { status: 401 },
    )
  }

  try {
    // Validation Zod en inline (safeParse) plutôt que via validateBody() :
    // le body a déjà été consommé via req.text() pour la vérification HMAC.
    let parsedBody: unknown
    try {
      parsedBody = JSON.parse(rawBody)
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }
    const parsed = lemlistWebhookSchema.safeParse(parsedBody)
    if (!parsed.success) {
      // publicErrors: false équivalent — on ne leak pas la structure au sender
      return NextResponse.json({ error: "Invalid input" }, { status: 400 })
    }
    const body = parsed.data
    const { email, event, campaignName, campaignId: lemlistCampaignId } = body

    console.log(
      `[Lemlist Webhook] event=${event} email=${email ?? "n/a"} campaign=${campaignName ?? "n/a"} campaignId=${lemlistCampaignId ?? "n/a"} auth=${method}`,
    )

    if (!email) return NextResponse.json({ ok: true })

    const contact = await prisma.crmContact.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
    })

    if (!contact) {
      console.log(`[Lemlist Webhook] No CRM contact found for ${email}`)
      return NextResponse.json({ ok: true })
    }

    // Map Lemlist events to lifecycle stages
    const stageMap: Record<string, string> = {
      emailsSent: "sequence_active",
      emailsOpened: "sequence_active",
      emailsClicked: "sequence_active",
      emailsReplied: "replied",
      emailsBounced: "sequence_active",
      contacted: "sequence_active",
      interested: "replied",
      hooked: "replied",
    }

    // Map Lemlist events to lemlistStatus
    const lemlistStatusMap: Record<string, string> = {
      emailsSent: "active",
      emailsOpened: "active",
      emailsClicked: "active",
      emailsReplied: "replied",
      emailsBounced: "bounced",
      emailsUnsubscribed: "unsubscribed",
      contacted: "active",
      interested: "replied",
      hooked: "replied",
    }

    const newStage = stageMap[event]
    const newLemlistStatus = lemlistStatusMap[event]

    // Build update data
    const updateData: Record<string, unknown> = { lastInteraction: new Date() }
    if (newStage) updateData.lifecycleStage = newStage
    if (newLemlistStatus) updateData.lemlistStatus = newLemlistStatus
    if (campaignName) updateData.lemlistCampaignName = campaignName

    // Increment step for emailsSent events
    if (event === "emailsSent" && typeof contact.lemlistStep === "number") {
      updateData.lemlistStep = contact.lemlistStep + 1
      // Check if sequence is done
      if (
        typeof contact.lemlistTotalSteps === "number" &&
        contact.lemlistStep + 1 >= contact.lemlistTotalSteps
      ) {
        updateData.lemlistStatus = "completed"
      }
    }

    await prisma.crmContact.update({
      where: { id: contact.id },
      data: updateData,
    })

    // Log as activity
    await prisma.activity.create({
      data: {
        type: "clay_sequence_event",
        description: `Lemlist: ${event}${campaignName ? ` (${campaignName})` : ""}`,
        contactId: contact.id,
        performedBy: "system",
      },
    })

    // ── Sync to OutreachCampaign ──
    if (campaignName || lemlistCampaignId) {
      try {
        // Find by lemlistCampaignId first, then by name
        let outreachCampaign = lemlistCampaignId
          ? await prisma.outreachCampaign.findUnique({ where: { lemlistCampaignId } })
          : null
        if (!outreachCampaign && campaignName) {
          outreachCampaign = await prisma.outreachCampaign.findFirst({ where: { name: campaignName } })
        }
        if (!outreachCampaign) {
          outreachCampaign = await prisma.outreachCampaign.create({
            data: {
              name: campaignName ?? "Unknown Campaign",
              lemlistCampaignId: lemlistCampaignId ?? null,
              owner: contact.dealOwner ?? "Unknown",
              platform: "lemlist",
              status: "active",
            },
          })
        }

        // Increment the appropriate metric
        const incrementField: Record<string, string> = {
          emailsSent: "totalSent",
          emailsOpened: "totalOpened",
          emailsClicked: "totalClicked",
          emailsReplied: "totalReplied",
          emailsBounced: "totalBounced",
          emailsUnsubscribed: "totalUnsubscribed",
          contacted: "totalSent",
          interested: "repliesInterested",
          notInterested: "repliesNotInterested",
        }

        const field = incrementField[event]
        if (field) {
          await prisma.outreachCampaign.update({
            where: { id: outreachCampaign.id },
            data: { [field]: { increment: 1 } },
          })
        }
      } catch (err) {
        console.error("[Lemlist Webhook] OutreachCampaign sync error:", err)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[Lemlist Webhook] Processing error:", error)
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 },
    )
  }
}
