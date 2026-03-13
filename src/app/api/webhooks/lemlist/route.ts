import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(request: Request) {
  const secret = request.headers.get("x-webhook-secret")
  if (process.env.LEMLIST_WEBHOOK_SECRET && secret !== process.env.LEMLIST_WEBHOOK_SECRET) {
    return NextResponse.json({ ok: true }) // Silent reject, always 200
  }

  try {
    const body = await request.json()
    const { email, event, campaignName, stepsCompleted, totalSteps } = body

    if (!email) return NextResponse.json({ ok: true })

    const contact = await prisma.contact.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
    })

    if (!contact) return NextResponse.json({ ok: true })

    // Map Lemlist events to outreach statuses
    const statusMap: Record<string, string> = {
      emailsSent: "sequenced",
      emailsOpened: "sequenced",
      emailsClicked: "sequenced",
      emailsReplied: "replied",
      emailsBounced: "disqualified",
      emailsUnsubscribed: "disqualified",
    }

    const outreachStatus = statusMap[event] || contact.outreachStatus

    // Upsert outreach sequence
    await prisma.outreachSequence.upsert({
      where: {
        id: `${contact.id}-lemlist`, // deterministic ID
      },
      update: {
        status: event === "emailsReplied" ? "replied" : event === "emailsBounced" ? "bounced" : "active",
        stepsCompleted: stepsCompleted ?? 0,
        totalSteps: totalSteps ?? 0,
        lastStepAt: new Date(),
      },
      create: {
        id: `${contact.id}-lemlist`,
        contactId: contact.id,
        platform: "lemlist",
        campaignName: campaignName || null,
        status: "active",
        stepsCompleted: stepsCompleted ?? 0,
        totalSteps: totalSteps ?? 0,
        lastStepAt: new Date(),
      },
    })

    // Update contact outreach status
    await prisma.contact.update({
      where: { id: contact.id },
      data: {
        outreachStatus,
        lemlistCampaignId: campaignName || contact.lemlistCampaignId,
        lastContactedAt: new Date(),
        ...(event === "emailsReplied" ? { lastRepliedAt: new Date() } : {}),
      },
    })
  } catch (error) {
    console.error("Lemlist webhook error:", error)
  }

  return NextResponse.json({ ok: true })
}
