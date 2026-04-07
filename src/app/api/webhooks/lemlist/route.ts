import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import crypto from "crypto"

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
    const body = JSON.parse(rawBody)
    const { email, event, campaignName } = body

    console.log(
      `[Lemlist Webhook] event=${event} email=${email ?? "n/a"} campaign=${campaignName ?? "n/a"} auth=${method}`,
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

    const newStage = stageMap[event]

    if (newStage) {
      await prisma.crmContact.update({
        where: { id: contact.id },
        data: {
          lifecycleStage: newStage,
          lastInteraction: new Date(),
        },
      })
    } else {
      // Still update lastInteraction for any event
      await prisma.crmContact.update({
        where: { id: contact.id },
        data: { lastInteraction: new Date() },
      })
    }

    // Log as activity
    await prisma.activity.create({
      data: {
        type: "clay_sequence_event",
        description: `Lemlist: ${event}${campaignName ? ` (${campaignName})` : ""}`,
        contactId: contact.id,
        performedBy: "system",
      },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[Lemlist Webhook] Processing error:", error)
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 },
    )
  }
}
