import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireWebhookSecret } from "@/lib/webhook-auth"

export async function POST(request: Request) {
  const authFail = requireWebhookSecret(request, { envVarName: "TRIGIFY_WEBHOOK_SECRET" })
  if (authFail) return authFail

  try {
    const body = await request.json()
    const { email, signal_type, title, detail, score, name, company } = body

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

    // Create intent signal
    await prisma.intentSignal.create({
      data: {
        contactId: contact.id,
        source: "trigify",
        signalType: signal_type || "job_change",
        title: title || "Trigify Signal",
        detail: detail || null,
        score: score ?? 15,
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
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
      data: { relationshipScore: Math.min(totalScore, 100) },
    })
  } catch (error) {
    console.error("Trigify webhook error:", error)
  }

  return NextResponse.json({ ok: true })
}
