import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"

// DELETE /api/crm/outreach/suppression/[id] — remove entry and re-enable contact
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requirePageAccess("crm")
  if (error) return error

  const { id } = await params

  try {
    const entry = await prisma.suppressionEntry.findUnique({ where: { id } })
    if (!entry) {
      return NextResponse.json({ error: "Suppression entry not found" }, { status: 404 })
    }

    // Re-enable the matching CRM contact if one exists
    const contact = await prisma.crmContact.findUnique({
      where: { email: entry.email },
    })
    if (contact) {
      await prisma.crmContact.update({
        where: { email: entry.email },
        data: { doNotContact: false },
      })
    }

    await prisma.suppressionEntry.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[Suppression DELETE]", err)
    return NextResponse.json({ error: "Failed to remove suppression entry" }, { status: 500 })
  }
}
