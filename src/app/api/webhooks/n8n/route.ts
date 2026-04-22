import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireWebhookSecret } from "@/lib/webhook-auth"
import { validateBody } from "@/lib/validate"
import { n8nWebhookSchema } from "../_schemas"

export async function POST(request: Request) {
  const authFail = requireWebhookSecret(request, { envVarName: "N8N_WEBHOOK_SECRET" })
  if (authFail) return authFail

  const v = await validateBody(request, n8nWebhookSchema, { publicErrors: false })
  if ("error" in v) return v.error
  const { action, contactEmail, data } = v.data

  try {
    const body = v.data

    const contact = await prisma.crmContact.findFirst({
      where: { email: { equals: contactEmail, mode: "insensitive" } },
    })

    if (!contact) return NextResponse.json({ ok: true })

    switch (action) {
      case "create_signal":
        await prisma.intentSignal.create({
          data: {
            contactId: contact.id,
            source: "n8n",
            signalType: data?.signalType || "web_visit",
            title: data?.title || "n8n Signal",
            detail: data?.detail || null,
            score: data?.score ?? 10,
            expiresAt: data?.expiresAt ? new Date(data.expiresAt) : null,
            raw: body,
          },
        })
        break

      case "update_contact": {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updateData: any = {}
        const allowed = [
          "firstName", "lastName", "company", "vertical", "lifecycleStage", "source", "country",
          "outreachStatus", "leadSource", "clientType", "dealOwner", "introducerId",
        ] as const
        // Cast to indexable record — Zod narrows `data` to the discriminated
        // update_contact shape, which TypeScript rejects for generic string indexing.
        const d = data as Record<string, unknown> | undefined
        for (const key of allowed) {
          if (d?.[key] !== undefined) updateData[key] = d[key]
        }
        if (Object.keys(updateData).length > 0) {
          await prisma.crmContact.update({ where: { id: contact.id }, data: updateData })
        }
        break
      }

      case "create_interaction":
        await prisma.activity.create({
          data: {
            contactId: contact.id,
            type: data?.type || "note",
            description: data?.content || "n8n interaction",
            performedBy: "system",
          },
        })
        await prisma.crmContact.update({
          where: { id: contact.id },
          data: { lastInteraction: new Date() },
        })
        break
    }
  } catch (error) {
    console.error("n8n webhook error:", error)
  }

  return NextResponse.json({ ok: true })
}
