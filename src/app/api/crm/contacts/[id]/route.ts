import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePageAccess, requireAdmin } from "@/lib/admin"

// GET /api/crm/contacts/[id] — full detail with relations
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requirePageAccess("crm")
  if (error) return error

  const { id } = await params

  try {
    const contact = await prisma.crmContact.findUnique({
      where: { id },
      include: {
        company: true,
        activities: { orderBy: { createdAt: "desc" }, take: 20 },
        deals: { orderBy: { createdAt: "desc" } },
        tasks: { orderBy: { dueDate: "asc" }, where: { status: "pending" } },
        introducer: { select: { id: true, firstName: true, lastName: true, email: true } },
        referredContacts: { select: { id: true, firstName: true, lastName: true, email: true } },
        supportTickets: { select: { id: true, subject: true, status: true, priority: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 5 },
      },
    })

    if (!contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 })
    }

    // Compute smart fields
    const daysSinceLastContact = contact.lastInteraction
      ? Math.floor((Date.now() - new Date(contact.lastInteraction).getTime()) / (1000 * 60 * 60 * 24))
      : null

    return NextResponse.json({
      contact: {
        ...contact,
        daysSinceLastContact,
      },
    })
  } catch (err) {
    console.error("[CRM Contact GET]", err)
    return NextResponse.json({ error: "Failed to fetch contact" }, { status: 500 })
  }
}

// PATCH /api/crm/contacts/[id] — update contact, audit changed fields
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error: pageErr, session } = await requirePageAccess("crm")
  if (pageErr) return pageErr

  const { id } = await params

  try {
    const existing = await prisma.crmContact.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 })
    }

    const body = await request.json()
    const userId = session.user?.email ?? "unknown"

    // Build update data from only the fields provided
    const allowedFields = [
      "firstName", "lastName", "email", "phone", "linkedinUrl", "jobTitle",
      "companyId", "vertical", "subVertical", "geoZone", "dealOwner",
      "acquisitionSource", "acquisitionSourceDetail",
      "lifecycleStage", "icpFit", "contactType",
      "companySize", "fundingStage", "techStack", "annualRevenueRange",
      "country", "city", "doNotContact", "pinnedNote",
      "telegram", "whatsapp", "website",
      "relationshipStrength", "relationshipScore", "aiSummary",
      "introducerId", "introducerVertical", "introducerGeo",
      "outreachGroup",
      "lastInteraction", "nextScheduledMeeting",
      "totalInteractions", "avgResponseTimeHours",
    ] as const

    const data: Record<string, unknown> = {}
    const auditEntries: { field: string; oldValue: string | null; newValue: string | null }[] = []

    for (const field of allowedFields) {
      if (field in body) {
        const oldVal = (existing as Record<string, unknown>)[field]
        const newVal = body[field]

        // Only update if value actually changed
        const oldStr = oldVal == null ? null : String(oldVal)
        const newStr = newVal == null ? null : String(newVal)

        if (oldStr !== newStr) {
          data[field] = newVal
          auditEntries.push({
            field,
            oldValue: oldStr,
            newValue: newStr,
          })
        }
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ contact: existing, message: "No changes detected" })
    }

    const updated = await prisma.crmContact.update({
      where: { id },
      data,
      include: {
        company: { select: { id: true, name: true } },
      },
    })

    // Create AuditLog entries for each changed field
    if (auditEntries.length > 0) {
      await prisma.auditLog.createMany({
        data: auditEntries.map((entry) => ({
          entityType: "contact",
          entityId: id,
          action: "updated",
          field: entry.field,
          oldValue: entry.oldValue,
          newValue: entry.newValue,
          performedBy: userId,
        })),
      })
    }

    return NextResponse.json({ contact: updated })
  } catch (err) {
    console.error("[CRM Contact PATCH]", err)
    return NextResponse.json({ error: "Failed to update contact" }, { status: 500 })
  }
}

// DELETE /api/crm/contacts/[id] — admin only
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error: adminErr, session } = await requireAdmin()
  if (adminErr) return adminErr

  const { id } = await params

  try {
    const existing = await prisma.crmContact.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 })
    }

    await prisma.crmContact.delete({ where: { id } })

    const userId = session?.user?.email ?? "unknown"
    await prisma.auditLog.create({
      data: {
        entityType: "contact",
        entityId: id,
        action: "deleted",
        oldValue: `${existing.firstName} ${existing.lastName} (${existing.email})`,
        performedBy: userId,
      },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[CRM Contact DELETE]", err)
    return NextResponse.json({ error: "Failed to delete contact" }, { status: 500 })
  }
}
