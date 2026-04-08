import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"

// GET /api/crm/outreach/domains — list all domains with campaigns
export async function GET() {
  const { error } = await requirePageAccess("crm")
  if (error) return error

  try {
    const domains = await prisma.outreachDomain.findMany({
      include: { campaigns: true },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ domains })
  } catch (err) {
    console.error("[Outreach Domains GET]", err)
    return NextResponse.json({ error: "Failed to fetch domains" }, { status: 500 })
  }
}

// POST /api/crm/outreach/domains — create a new domain
export async function POST(request: Request) {
  const { error } = await requirePageAccess("crm")
  if (error) return error

  try {
    const body = await request.json()
    const { domain, owner, mailbox } = body

    if (!domain || !owner || !mailbox) {
      return NextResponse.json(
        { error: "Missing required fields: domain, owner, mailbox" },
        { status: 400 },
      )
    }

    const existing = await prisma.outreachDomain.findUnique({ where: { domain } })
    if (existing) {
      return NextResponse.json(
        { error: "A domain with this name already exists", existingId: existing.id },
        { status: 409 },
      )
    }

    const created = await prisma.outreachDomain.create({
      data: {
        domain,
        owner,
        mailbox,
        provider: body.provider ?? "google_workspace",
        status: body.status ?? "warmup",
        warmupStartDate: body.warmupStartDate ? new Date(body.warmupStartDate) : null,
        activeDate: body.activeDate ? new Date(body.activeDate) : null,
        spfValid: body.spfValid ?? false,
        dkimValid: body.dkimValid ?? false,
        dmarcValid: body.dmarcValid ?? false,
        trackingDomain: body.trackingDomain ?? null,
        trackingValid: body.trackingValid ?? false,
        notes: body.notes ?? null,
      },
      include: { campaigns: true },
    })

    return NextResponse.json({ domain: created }, { status: 201 })
  } catch (err) {
    console.error("[Outreach Domains POST]", err)
    return NextResponse.json({ error: "Failed to create domain" }, { status: 500 })
  }
}
