import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"

/**
 * POST /api/crm/contacts/check-duplicates
 * Accepts an array of emails and returns which ones already exist in the CRM.
 * Used by the CSV Import Wizard preview step to flag existing contacts.
 */
export async function POST(request: Request) {
  const { error } = await requirePageAccess("crm")
  if (error) return error

  try {
    const body = await request.json()
    const { emails } = body as { emails: string[] }

    if (!Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json({ existing: [] })
    }

    // Limit to 5000 to prevent abuse
    const emailList = emails.slice(0, 5000).map((e) => e.toLowerCase().trim())

    const found = await prisma.crmContact.findMany({
      where: {
        email: { in: emailList, mode: "insensitive" },
      },
      select: { email: true },
    })

    const existing = found
      .map((c) => c.email?.toLowerCase())
      .filter(Boolean) as string[]

    return NextResponse.json({ existing })
  } catch (err) {
    console.error("[CRM Check Duplicates]", err)
    return NextResponse.json({ existing: [] })
  }
}
