import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

/**
 * GET /api/me — Returns the current user's Employee record
 * Used for admin checks, personalization, calendar scoping, etc.
 */
export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const email = session.user?.email
  if (!email) return NextResponse.json({ employee: null })

  const employee = await prisma.employee.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
      entity: true,
      isAdmin: true,
      telegramChatId: true,
    },
  })

  return NextResponse.json({ employee })
}
