import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(request: Request) {
  const secret = request.headers.get("x-webhook-secret")
  if (process.env.N8N_WEBHOOK_SECRET && secret !== process.env.N8N_WEBHOOK_SECRET) {
    return NextResponse.json({ ok: true })
  }

  try {
    const body = await request.json()
    const { action, contactEmail, data } = body

    if (!action || !contactEmail) return NextResponse.json({ ok: true })

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
        ]
        for (const key of allowed) {
          if (data?.[key] !== undefined) updateData[key] = data[key]
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
