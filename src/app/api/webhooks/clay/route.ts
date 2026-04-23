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

    await prisma.intentSignal.create({
      data: {
        contactId: contact.id,
        source: "clay",
        signalType: enrichment_type || "tech_install",
        title: title || "Clay Enrichment",
        detail: typeof data === "string" ? data : JSON.stringify(data),
        score: score ?? 10,
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        raw: body,
      },
    })

    // Recalculate intent score
    const now = new Date()
    const signals = await prisma.intentSignal.findMany({
      where: { contactId: contact.id },
      select: { score: true, expiresAt: true },
    })
    const totalScore = signals
      .filter((s) => !s.expiresAt || s.expiresAt > now)
      .reduce((sum, s) => sum + s.score, 0)

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
