import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canAccess, type RoleLevel } from "@/lib/permissions"

export async function GET(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const teamView = searchParams.get("teamView")
  const userEmail = session.user?.email

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {}

  // Scope to briefs where user is an attendee, unless admin with teamView
  if (userEmail && teamView !== "true") {
    const employee = await prisma.employee.findFirst({
      where: { email: { equals: userEmail, mode: "insensitive" } },
      select: { roleLevel: true, name: true },
    })
    const userRole = (employee?.roleLevel ?? "member") as RoleLevel
    const isAdmin = canAccess(userRole, "admin")

    if (!isAdmin) {
      // Non-admin: only briefs where user email or name is in attendees
      where.OR = [
        { attendees: { has: userEmail } },
        ...(employee?.name ? [{ attendees: { has: employee.name } }] : []),
        { createdBy: userEmail },
      ]
    }
  }

  const briefs = await prisma.meetingBrief.findMany({
    where,
    include: { contact: { select: { id: true, name: true, company: true } } },
    orderBy: { meetingDate: "desc" },
    take: 20,
  })

  return NextResponse.json({ briefs })
}
