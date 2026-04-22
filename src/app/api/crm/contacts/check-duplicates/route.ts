import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"
import { validateBody } from "@/lib/validate"
import { checkDuplicatesSchema } from "../../_schemas"

/**
 * POST /api/crm/contacts/check-duplicates
 * Accepts an array of emails and returns which ones already exist in the CRM.
 * Used by the CSV Import Wizard preview step to flag existing contacts.
 */
export async function POST(request: Request) {
  const { error } = await requirePageAccess("crm")
  if (error) return error

  try {
    const v = await validateBody(request, checkDuplicatesSchema)
    if ("error" in v) return v.error
    const { emails } = v.data

    if (emails.length === 0) {
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
