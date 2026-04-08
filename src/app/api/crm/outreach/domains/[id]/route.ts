import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"

// PATCH /api/crm/outreach/domains/[id] — update domain fields
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requirePageAccess("crm")
  if (error) return error

  const { id } = await params

  try {
    const existing = await prisma.outreachDomain.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: "Domain not found" }, { status: 404 })
    }

    const body = await request.json()

    const allowedFields = [
      "domain", "owner", "mailbox", "provider", "status",
      "warmupStartDate", "activeDate",
      "spfValid", "dkimValid", "dmarcValid",
      "trackingDomain", "trackingValid",
      "openRate", "replyRate", "bounceRate", "spamRate", "inboxPlacement",
      "isBlacklisted", "blacklistDetails",
      "lastHealthCheck", "notes",
    ] as const

    const data: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (field in body) {
        // Convert date strings to Date objects for DateTime fields
        if (["warmupStartDate", "activeDate", "lastHealthCheck"].includes(field) && body[field]) {
          data[field] = new Date(body[field])
        } else {
          data[field] = body[field]
        }
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ domain: existing, message: "No changes detected" })
    }

    const updated = await prisma.outreachDomain.update({
      where: { id },
      data,
      include: { campaigns: true },
    })

    return NextResponse.json({ domain: updated })
  } catch (err) {
    console.error("[Outreach Domain PATCH]", err)
    return NextResponse.json({ error: "Failed to update domain" }, { status: 500 })
  }
}
