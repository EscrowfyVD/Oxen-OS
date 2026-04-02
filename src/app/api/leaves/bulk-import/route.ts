import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

function calculateBusinessDays(start: Date, end: Date): number {
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

  const me = await prisma.employee.findFirst({
    where: { email: { equals: session.user.email, mode: "insensitive" } },
  })
  if (!me?.isAdmin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 })
  }

  const body = await request.json()
  const { entries } = body as {
    entries: { email: string; type: string; startDate: string; endDate: string; reason?: string }[]
  }

  if (!Array.isArray(entries) || entries.length === 0) {
    return NextResponse.json({ error: "No entries provided" }, { status: 400 })
  }

  // Fetch all employees by email for matching
  const allEmployees = await prisma.employee.findMany({
    select: { id: true, email: true, name: true },
  })
  const emailToEmployee = new Map(allEmployees.map((e) => [e.email?.toLowerCase(), e]))

  const results: { success: number; failed: number; errors: string[] } = { success: 0, failed: 0, errors: [] }

  for (const entry of entries) {
    const emp = emailToEmployee.get(entry.email?.toLowerCase())
    if (!emp) {
      results.failed++
      results.errors.push(`Employee not found: ${entry.email}`)
      continue
    }

    const type = entry.type?.toLowerCase()
    if (!["vacation", "sick", "ooo"].includes(type)) {
      results.failed++
      results.errors.push(`Invalid type "${entry.type}" for ${entry.email}`)
      continue
    }

    try {
      const start = new Date(entry.startDate)
      const end = new Date(entry.endDate)
      const totalDays = calculateBusinessDays(start, end)

      if (totalDays <= 0) {
        results.failed++
        results.errors.push(`Invalid dates for ${entry.email}: ${entry.startDate} - ${entry.endDate}`)
        continue
      }

      // Create approved leave request
      await prisma.leaveRequest.create({
        data: {
          employeeId: emp.id,
          type,
          startDate: start,
          endDate: end,
          reason: entry.reason || null,
          status: "approved",
          reviewedById: me.id,
          reviewedAt: new Date(),
          reviewNote: "Bulk import by admin",
          totalDays,
          source: "bulk_import",
        },
      })

      // Update balance
      const year = start.getFullYear()
      const balanceField = type === "vacation" ? "vacationUsed" : type === "sick" ? "sickUsed" : "oooUsed"
      await prisma.leaveBalance.upsert({
        where: { employeeId_year: { employeeId: emp.id, year } },
        create: { employeeId: emp.id, year, [balanceField]: totalDays },
        update: { [balanceField]: { increment: totalDays } },
      })

      results.success++
    } catch (err) {
      results.failed++
      results.errors.push(`Error for ${entry.email}: ${err instanceof Error ? err.message : "Unknown error"}`)
    }
  }

  return NextResponse.json({ results })
}
