import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"

// GET /api/crm/outreach/campaigns — list all campaigns with domain, optional owner filter
export async function GET(request: Request) {
  const { error } = await requirePageAccess("crm")
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const owner = searchParams.get("owner")

    const where: Record<string, unknown> = {}
    if (owner) {
      where.owner = owner
    }

    const campaigns = await prisma.outreachCampaign.findMany({
      where,
      include: { domain: true },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ campaigns })
  } catch (err) {
    console.error("[Outreach Campaigns GET]", err)
    return NextResponse.json({ error: "Failed to fetch campaigns" }, { status: 500 })
  }
}

// POST /api/crm/outreach/campaigns — create a new campaign
export async function POST(request: Request) {
  const { error } = await requirePageAccess("crm")
  if (error) return error

  try {
    const body = await request.json()
    const { name, owner } = body

    if (!name || !owner) {
      return NextResponse.json(
        { error: "Missing required fields: name, owner" },
        { status: 400 },
      )
    }

    const created = await prisma.outreachCampaign.create({
      data: {
        name,
        owner,
        vertical: body.vertical ?? null,
        domainId: body.domainId ?? null,
        status: body.status ?? "active",
        platform: body.platform ?? "lemlist",
        totalSent: body.totalSent ?? 0,
        totalOpened: body.totalOpened ?? 0,
        totalClicked: body.totalClicked ?? 0,
        totalReplied: body.totalReplied ?? 0,
        totalBounced: body.totalBounced ?? 0,
        totalUnsubscribed: body.totalUnsubscribed ?? 0,
        repliesInterested: body.repliesInterested ?? 0,
        repliesNotInterested: body.repliesNotInterested ?? 0,
        repliesOoo: body.repliesOoo ?? 0,
        meetingsBooked: body.meetingsBooked ?? 0,
        startDate: body.startDate ? new Date(body.startDate) : null,
        endDate: body.endDate ? new Date(body.endDate) : null,
      },
      include: { domain: true },
    })

    return NextResponse.json({ campaign: created }, { status: 201 })
  } catch (err) {
    console.error("[Outreach Campaigns POST]", err)
    return NextResponse.json({ error: "Failed to create campaign" }, { status: 500 })
  }
}
