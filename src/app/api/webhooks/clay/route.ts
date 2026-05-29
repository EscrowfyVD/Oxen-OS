import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireWebhookSecret } from "@/lib/webhook-auth"
import { validateBody } from "@/lib/validate"
import { childLoggerFromRequest, serializeError } from "@/lib/logger"
import { clayWebhookSchema } from "../_schemas"

export async function POST(request: Request) {
  const authFail = requireWebhookSecret(request, { envVarName: "CLAY_WEBHOOK_SECRET" })
  if (authFail) return authFail

  const v = await validateBody(request, clayWebhookSchema, { publicErrors: false })
  if ("error" in v) return v.error
  const { email, enrichment_type, data, title, score } = v.data

  const log = childLoggerFromRequest(request).child({ webhook: "clay" })

  try {
    const body = v.data

    if (!email) return NextResponse.json({ ok: true })

    const contact = await prisma.crmContact.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
    })

    if (!contact) return NextResponse.json({ ok: true })

    // Sprint S1 — IntentSignal now requires a SignalTypeRegistry FK.
    // This legacy webhook upserts a placeholder registry entry by code
    // ("clay_legacy_intent") so it can keep ingesting without knowing
    // about the canonical signal types. The placeholder is created with
    // sensible defaults (10 points, 90-day linear decay, INTENT) and
    // can be deprecated in Sprint S1 batch 4 when this route is rewired
    // to use the canonical registry codes.
    const registryEntry = await prisma.signalTypeRegistry.upsert({
      where: { code: "clay_legacy_intent" },
      create: {
        code: "clay_legacy_intent",
        label: "Clay legacy intent signal",
        description:
          "Placeholder for the legacy /api/webhooks/clay route — to be deprecated in Sprint S1 batch 4.",
        defaultPoints: 10,
        decayDays: 90,
        decayCurve: "LINEAR",
        category: "INTENT",
      },
      update: {},
    })

    await prisma.intentSignal.create({
      data: {
        contactId: contact.id,
        companyId: contact.companyId,
        signalTypeId: registryEntry.id,
        source: "clay",
        signalType: enrichment_type || "tech_install",
        title: title || "Clay Enrichment",
        detail: typeof data === "string" ? data : JSON.stringify(data),
        points: score ?? 10,
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        // Sprint 3a categorical axes — copied from the (placeholder) registry.
        // clay_legacy_intent has intentCategory=null, so these signals stay
        // correctly excluded from the A-I Intent score until this route is
        // rewired to canonical codes (sub-backlog). Stamping it now closes the
        // "column added, writer not wired" gap uniformly across all writers.
        intentCategory: registryEntry.intentCategory,
        signalLevel: registryEntry.signalLevel,
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
      data: {
        relationshipScore: Math.min(totalScore, 100),
      },
    })
  } catch (error) {
    log.error({ err: serializeError(error) }, "clay webhook processing failed")
  }

  return NextResponse.json({ ok: true })
}
