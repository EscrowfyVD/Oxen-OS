import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const { searchParams } = new URL(request.url)
  const limit = parseInt(searchParams.get("limit") || "50", 10)
  const offset = parseInt(searchParams.get("offset") || "0", 10)

  const [emails, total] = await Promise.all([
    prisma.email.findMany({
      where: { contactId: id },
      orderBy: { date: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.email.count({ where: { contactId: id } }),
  ])

  return NextResponse.json({ emails, total })
}
