import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(request: Request) {
  const secret = request.headers.get("x-webhook-secret")
  if (process.env.LEMLIST_WEBHOOK_SECRET && secret !== process.env.LEMLIST_WEBHOOK_SECRET) {
    return NextResponse.json({ ok: true })
  }

  try {
    const body = await request.json()
    const { email, event, campaignName } = body

    if (!email) return NextResponse.json({ ok: true })

    const contact = await prisma.crmContact.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
    })

    if (!contact) return NextResponse.json({ ok: true })

    // Map Lemlist events to lifecycle stages
    const stageMap: Record<string, string> = {
      emailsSent: "sequence_active",
      emailsOpened: "sequence_active",
      emailsClicked: "sequence_active",
      emailsReplied: "replied",
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
  } catch (error) {
    console.error("Lemlist webhook error:", error)
  }

  return NextResponse.json({ ok: true })
}
