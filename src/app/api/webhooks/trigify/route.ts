import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireWebhookSecret } from "@/lib/webhook-auth"
import { validateBody } from "@/lib/validate"
import { childLoggerFromRequest, serializeError } from "@/lib/logger"
import { trigifyWebhookSchema } from "../_schemas"

export async function POST(request: Request) {
  const authFail = requireWebhookSecret(request, { envVarName: "TRIGIFY_WEBHOOK_SECRET" })
  if (authFail) return authFail

  const v = await validateBody(request, trigifyWebhookSchema, { publicErrors: false })
  if ("error" in v) return v.error
  const { email, signal_type, title, detail, score, name, company } = v.data

  const log = childLoggerFromRequest(request).child({ webhook: "trigify" })

  try {
    const body = v.data

    if (!email) return NextResponse.json({ ok: true })

    // Find or create contact
    let contact = await prisma.crmContact.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
    })

    if (!contact) {
      const fallbackName = name || email.split("@")[0]
      const [first, ...rest] = fallbackName.split(" ")
      contact = await prisma.crmContact.create({
        data: {
          firstName: first,
          lastName: rest.length > 0 ? rest.join(" ") : "",
          email,
          acquisitionSource: "Other",
          acquisitionSourceDetail: "Trigify",
          lifecycleStage: "new_lead",
          createdBy: "webhook:trigify",
        },
      })
    }

    // Sprint S1 — IntentSignal now requires a SignalTypeRegistry FK.
    // Upsert a placeholder entry by code ("trigify_intent_signal") with
    // sensible defaults (15 points / 90-day linear decay / INTENT) so
    // this legacy webhook can keep ingesting without knowing about the
    // canonical signal type catalog. To be deprecated when the route
    // is rewired in a follow-up batch.
    const registryEntry = await prisma.signalTypeRegistry.upsert({
      where: { code: "trigify_intent_signal" },
      create: {
        code: "trigify_intent_signal",
        label: "Trigify intent signal",
        description:
          "Placeholder for the legacy /api/webhooks/trigify route — to be deprecated in a follow-up Sprint S1 batch.",
        defaultPoints: 15,
        decayDays: 90,
        decayCurve: "LINEAR",
        category: "INTENT",
      },
      update: {},
    })

    // Create intent signal
    await prisma.intentSignal.create({
      data: {
        contactId: contact.id,
        companyId: contact.companyId,
        signalTypeId: registryEntry.id,
        source: "trigify",
        signalType: signal_type || "job_change",
        title: title || "Trigify Signal",
        detail: detail || null,
        points: score ?? 15,
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
        metadata: body,
      },
    })

    // Recalculate intent score
    const now = new Date()
    const signals = await prisma.intentSignal.findMany({
      where: { contactId: contact.id },
      select: { points: true, expiresAt: true },
    })
    const totalScore = signals
      .filter((s) => !s.expiresAt || s.expiresAt > now)
      .reduce((sum, s) => sum + s.points, 0)

    await prisma.crmContact.update({
      where: { id: contact.id },
      data: { relationshipScore: Math.min(totalScore, 100) },
    })
  } catch (error) {
    log.error({ err: serializeError(error) }, "trigify webhook processing failed")
  }

  return NextResponse.json({ ok: true })
}
