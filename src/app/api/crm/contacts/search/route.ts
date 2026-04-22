import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"
import { validateSearchParams } from "@/lib/validate"
import { searchContactsQuery } from "../../_schemas"

// GET /api/crm/contacts/search?q=... — fuzzy search across name, email, company
export async function GET(request: Request) {
  const { error } = await requirePageAccess("crm")
  if (error) return error

  const { searchParams } = new URL(request.url)
  const vq = validateSearchParams(searchParams, searchContactsQuery)
  if ("error" in vq) return vq.error
  const { q, limit } = vq.data

  if (!q || q.trim().length === 0) {
    return NextResponse.json({ contacts: [] })
  }

  const trimmed = q.trim()

  try {
    const contacts = await prisma.crmContact.findMany({
      where: {
        OR: [
          { firstName: { contains: trimmed, mode: "insensitive" } },
          { lastName: { contains: trimmed, mode: "insensitive" } },
          { email: { contains: trimmed, mode: "insensitive" } },
          { company: { name: { contains: trimmed, mode: "insensitive" } } },
        ],
      },
      include: {
        company: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
    })

    return NextResponse.json({ contacts })
  } catch (err) {
    console.error("[CRM Search GET]", err)
    return NextResponse.json({ error: "Search failed" }, { status: 500 })
  }
}
