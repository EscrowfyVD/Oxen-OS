import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"

// POST /api/crm/outreach/suppression/bulk — bulk import suppression entries
export async function POST(request: Request) {
  const { error, session } = await requirePageAccess("crm")
  if (error) return error

  try {
    const body = await request.json()
    const { emails, reason, source } = body

    if (!Array.isArray(emails) || emails.length === 0 || !reason) {
      return NextResponse.json(
        { error: "Missing required fields: emails (non-empty array), reason" },
        { status: 400 },
      )
    }

    const userEmail = session?.user?.email ?? "unknown"
    let imported = 0
    let skipped = 0

    for (const email of emails) {
      if (!email || typeof email !== "string") {
        skipped++
        continue
      }

      const normalizedEmail = email.trim().toLowerCase()

      try {
        // Upsert suppression entry — skip if already exists
        await prisma.suppressionEntry.upsert({
          where: { email: normalizedEmail },
          update: {}, // No update if already exists
          create: {
            email: normalizedEmail,
            reason,
            source: source ?? null,
            addedBy: userEmail,
          },
        })

        // Set doNotContact=true on matching CRM contact
        const contact = await prisma.crmContact.findUnique({
          where: { email: normalizedEmail },
        })
        if (contact) {
          await prisma.crmContact.update({
            where: { email: normalizedEmail },
            data: { doNotContact: true },
          })
        }

        imported++
      } catch {
        skipped++
      }
    }

    return NextResponse.json({ imported, skipped })
  } catch (err) {
    console.error("[Suppression Bulk POST]", err)
    return NextResponse.json({ error: "Failed to bulk import suppression entries" }, { status: 500 })
  }
}
