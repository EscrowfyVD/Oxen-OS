import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

function calculateBusinessDays(start: Date, end: Date, halfDay: boolean): number {
  if (halfDay) return 0.5
  let days = 0
  const current = new Date(start)
  current.setHours(0, 0, 0, 0)
  const endDate = new Date(end)
  endDate.setHours(0, 0, 0, 0)
  while (current <= endDate) {
    const dow = current.getDay()
    if (dow !== 0 && dow !== 6) days++
    current.setDate(current.getDate() + 1)
  }
  return days
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Admin check
  const me = await prisma.employee.findFirst({
    where: { email: { equals: session.user.email, mode: "insensitive" } },
  })
  if (!me?.isAdmin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 })
  }

  const body = await request.json()
  const { employeeId, type, startDate, endDate, halfDay, halfDayPeriod, reason, reviewNote } = body

  if (!employeeId || !type || !startDate || !endDate) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }

  const start = new Date(startDate)
  const end = new Date(endDate)
  const totalDays = calculateBusinessDays(start, end, halfDay || false)

  // Create the leave request as already approved
  const leaveRequest = await prisma.leaveRequest.create({
    data: {
      employeeId,
      type,
      startDate: start,
      endDate: end,
      halfDay: halfDay || false,
      halfDayPeriod: halfDayPeriod || null,
      reason: reason || null,
      status: "approved",
      reviewedById: me.id,
      reviewedAt: new Date(),
      reviewNote: reviewNote || "Manual entry by admin",
      totalDays,
      source: "manual",
    },
    include: {
      employee: {
        select: { id: true, name: true, initials: true, avatarColor: true },
      },
    },
  })

  // Update the employee's balance
  const year = start.getFullYear()
  const balanceField = type === "vacation" ? "vacationUsed" : type === "sick" ? "sickUsed" : "oooUsed"

  await prisma.leaveBalance.upsert({
    where: { employeeId_year: { employeeId, year } },
    create: {
      employeeId,
      year,
      [balanceField]: totalDays,
    },
    update: {
      [balanceField]: { increment: totalDays },
    },
  })

  return NextResponse.json({ request: leaveRequest }, { status: 201 })
}
