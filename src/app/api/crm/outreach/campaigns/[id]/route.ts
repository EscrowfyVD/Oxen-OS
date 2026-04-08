import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"

// GET /api/crm/outreach/campaigns/[id] — single campaign detail with domain
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requirePageAccess("crm")
  if (error) return error

  const { id } = await params

  try {
    const campaign = await prisma.outreachCampaign.findUnique({
      where: { id },
      include: { domain: true },
    })

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    }

    return NextResponse.json({ campaign })
  } catch (err) {
    console.error("[Outreach Campaign GET]", err)
    return NextResponse.json({ error: "Failed to fetch campaign" }, { status: 500 })
  }
}

// PATCH /api/crm/outreach/campaigns/[id] — update campaign fields
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requirePageAccess("crm")
  if (error) return error

  const { id } = await params

  try {
    const existing = await prisma.outreachCampaign.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    }

    const body = await request.json()

    const allowedFields = [
      "name", "vertical", "owner", "domainId", "status", "platform",
      "totalSent", "totalOpened", "totalClicked", "totalReplied",
      "totalBounced", "totalUnsubscribed",
      "repliesInterested", "repliesNotInterested", "repliesOoo",
      "meetingsBooked", "startDate", "endDate",
    ] as const

    const data: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (field in body) {
        if (["startDate", "endDate"].includes(field) && body[field]) {
          data[field] = new Date(body[field])
        } else {
          data[field] = body[field]
        }
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ campaign: existing, message: "No changes detected" })
    }

    const updated = await prisma.outreachCampaign.update({
      where: { id },
      data,
      include: { domain: true },
    })

    return NextResponse.json({ campaign: updated })
  } catch (err) {
    console.error("[Outreach Campaign PATCH]", err)
    return NextResponse.json({ error: "Failed to update campaign" }, { status: 500 })
  }
}
