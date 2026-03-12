import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { sendTelegramNotification } from "@/lib/telegram"

/* ── Helper: count business days between two dates ── */
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

/* ── GET: list leave requests ── */
export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const employeeId = searchParams.get("employeeId")
  const status = searchParams.get("status")
  const type = searchParams.get("type")
  const startDate = searchParams.get("startDate")
  const endDate = searchParams.get("endDate")
  const all = searchParams.get("all") // admin: fetch all

  // Find current user
  const me = await prisma.employee.findFirst({
    where: { email: { equals: session.user.email, mode: "insensitive" } },
  })

  const where: Record<string, unknown> = {}

  // Non-admin can only see their own unless specific employeeId given by admin
  if (employeeId) {
    where.employeeId = employeeId
  } else if (!me?.isAdmin || all !== "true") {
    if (me) where.employeeId = me.id
  }

  if (status) where.status = status
  if (type) where.type = type
  if (startDate || endDate) {
    where.startDate = {}
    if (startDate) (where.startDate as Record<string, unknown>).gte = new Date(startDate)
    if (endDate) (where.startDate as Record<string, unknown>).lte = new Date(endDate)
  }

  const requests = await prisma.leaveRequest.findMany({
    where,
    include: {
      employee: {
        select: { id: true, name: true, initials: true, avatarColor: true, department: true },
      },
      reviewedBy: {
        select: { name: true },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json({ requests })
}

/* ── POST: create a leave request ── */
export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { type, startDate, endDate, halfDay, halfDayPeriod, reason } = body

  if (!type || !startDate || !endDate) {
    return NextResponse.json(
      { error: "Missing required fields: type, startDate, endDate" },
      { status: 400 }
    )
  }

  // Find current employee
  const employee = await prisma.employee.findFirst({
    where: { email: { equals: session.user.email, mode: "insensitive" } },
  })
  if (!employee) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 })
  }

  const start = new Date(startDate)
  const end = new Date(endDate)
  const totalDays = calculateBusinessDays(start, end, halfDay ?? false)

  // Validate balance
  const year = start.getFullYear()
  let balance = await prisma.leaveBalance.findUnique({
    where: { employeeId_year: { employeeId: employee.id, year } },
  })
  if (!balance) {
    balance = await prisma.leaveBalance.create({
      data: { employeeId: employee.id, year },
    })
  }

  // Check available balance
  const totalKey = `${type}Total` as "vacationTotal" | "sickTotal" | "oooTotal"
  const usedKey = `${type}Used` as "vacationUsed" | "sickUsed" | "oooUsed"
  const pendingKey = `${type}Pending` as "vacationPending"

  const total = type === "vacation" ? balance.vacationTotal : type === "sick" ? balance.sickTotal : balance.oooTotal
  const used = type === "vacation" ? balance.vacationUsed : type === "sick" ? balance.sickUsed : balance.oooUsed
  const pending = type === "vacation" ? balance.vacationPending : 0

  const remaining = total - used - pending
  if (totalDays > remaining) {
    return NextResponse.json(
      { error: `Insufficient balance. ${remaining} ${type} days remaining, requesting ${totalDays}.` },
      { status: 400 }
    )
  }

  // Create the request
  const leaveRequest = await prisma.leaveRequest.create({
    data: {
      employeeId: employee.id,
      type,
      startDate: start,
      endDate: end,
      halfDay: halfDay ?? false,
      halfDayPeriod: halfDayPeriod ?? null,
      reason: reason ?? null,
      totalDays,
      status: "pending",
    },
    include: {
      employee: {
        select: { id: true, name: true, initials: true, avatarColor: true, department: true },
      },
    },
  })

  // Update balance: increment pending
  if (type === "vacation") {
    await prisma.leaveBalance.update({
      where: { employeeId_year: { employeeId: employee.id, year } },
      data: { vacationPending: { increment: totalDays } },
    })
  } else if (type === "sick") {
    await prisma.leaveBalance.update({
      where: { employeeId_year: { employeeId: employee.id, year } },
      data: { sickUsed: { increment: totalDays } },
    })
  } else if (type === "ooo") {
    await prisma.leaveBalance.update({
      where: { employeeId_year: { employeeId: employee.id, year } },
      data: { oooUsed: { increment: totalDays } },
    })
  }

  // Notify all admins via Telegram
  try {
    const admins = await prisma.employee.findMany({
      where: { isAdmin: true, isActive: true, telegramChatId: { not: null } },
      select: { id: true },
    })
    const formatDate = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
    const msg = `🏖 *Leave Request*\n\n${employee.name} has requested ${type} leave\n${formatDate(start)} → ${formatDate(end)} \\(${totalDays} day${totalDays !== 1 ? "s" : ""}\\)\n${reason ? `Reason: ${reason}\n` : ""}\nPlease review at oxen\\.finance/absences`
    for (const admin of admins) {
      sendTelegramNotification(admin.id, msg).catch(() => {})
    }
  } catch { /* silent */ }

  // Return updated balance
  const updatedBalance = await prisma.leaveBalance.findUnique({
    where: { employeeId_year: { employeeId: employee.id, year } },
  })

  return NextResponse.json({ request: leaveRequest, balance: updatedBalance }, { status: 201 })
}
