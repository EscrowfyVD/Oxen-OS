import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const todayEnd = new Date(todayStart)
  todayEnd.setHours(23, 59, 59, 999)

  // Get current day of week (0=Sun, 1=Mon ... 6=Sat)
  const dow = todayStart.getDay()
  const weekStart = new Date(todayStart)
  weekStart.setDate(weekStart.getDate() - ((dow + 6) % 7)) // Monday
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6) // Sunday
  weekEnd.setHours(23, 59, 59, 999)

  const selectEmployee = {
    id: true,
    name: true,
    initials: true,
    avatarColor: true,
    department: true,
  }

  const [todayLeaves, weekLeaves] = await Promise.all([
    prisma.leaveRequest.findMany({
      where: {
        status: "approved",
        startDate: { lte: todayEnd },
        endDate: { gte: todayStart },
      },
      include: { employee: { select: selectEmployee } },
      orderBy: { startDate: "asc" },
    }),
    prisma.leaveRequest.findMany({
      where: {
        status: "approved",
        startDate: { lte: weekEnd },
        endDate: { gte: weekStart },
      },
      include: { employee: { select: selectEmployee } },
      orderBy: { startDate: "asc" },
    }),
  ])

  return NextResponse.json({
    today: todayLeaves.map((l) => ({
      id: l.id,
      employee: l.employee,
      type: l.type,
      startDate: l.startDate,
      endDate: l.endDate,
      halfDay: l.halfDay,
      halfDayPeriod: l.halfDayPeriod,
    })),
    thisWeek: weekLeaves.map((l) => ({
      id: l.id,
      employee: l.employee,
      type: l.type,
      startDate: l.startDate,
      endDate: l.endDate,
      halfDay: l.halfDay,
      halfDayPeriod: l.halfDayPeriod,
    })),
  })
}
