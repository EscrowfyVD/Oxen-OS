import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"

// GET /api/crm/outreach/suppression — paginated list with search and reason filter
export async function GET(request: Request) {
  const { error } = await requirePageAccess("crm")
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)))
    const skip = (page - 1) * limit

    const q = searchParams.get("q")
    const reason = searchParams.get("reason")

    const where: Record<string, unknown> = {}
    if (q) {
      where.email = { contains: q, mode: "insensitive" }
    }
    if (reason) {
      where.reason = reason
    }

    const [entries, total] = await Promise.all([
      prisma.suppressionEntry.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.suppressionEntry.count({ where }),
    ])

    return NextResponse.json({
      entries,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (err) {
    console.error("[Suppression GET]", err)
    return NextResponse.json({ error: "Failed to fetch suppression entries" }, { status: 500 })
  }
}

// POST /api/crm/outreach/suppression — add single suppression entry
export async function POST(request: Request) {
  const { error, session } = await requirePageAccess("crm")
  if (error) return error

  try {
    const body = await request.json()
    const { email, reason } = body

    if (!email || !reason) {
      return NextResponse.json(
        { error: "Missing required fields: email, reason" },
        { status: 400 },
      )
    }

    const existing = await prisma.suppressionEntry.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json(
        { error: "This email is already on the suppression list", existingId: existing.id },
        { status: 409 },
      )
    }

    const userEmail = session?.user?.email ?? "unknown"

    // Check if there is a CRM contact with this email and set doNotContact=true
    const contact = await prisma.crmContact.findUnique({ where: { email } })
    let contactId: string | null = null
    if (contact) {
      await prisma.crmContact.update({
        where: { email },
        data: { doNotContact: true },
      })
      contactId = contact.id
    }

    const entry = await prisma.suppressionEntry.create({
      data: {
        email,
        reason,
        source: body.source ?? null,
        addedBy: userEmail,
        contactId,
      },
    })

    return NextResponse.json({ entry }, { status: 201 })
  } catch (err) {
    console.error("[Suppression POST]", err)
    return NextResponse.json({ error: "Failed to add suppression entry" }, { status: 500 })
  }
}
