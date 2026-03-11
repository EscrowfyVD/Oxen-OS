import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const days = parseInt(searchParams.get("days") || "30", 10)
  const dateFrom = searchParams.get("dateFrom")
  const dateTo = searchParams.get("dateTo")

  let start: Date
  let end: Date

  if (dateFrom && dateTo) {
    start = new Date(dateFrom)
    end = new Date(dateTo + "T23:59:59Z")
  } else {
    end = new Date()
    start = new Date()
    start.setDate(start.getDate() - days)
  }

  // All tickets in range
  const tickets = await prisma.supportTicket.findMany({
    where: {
      createdAt: { gte: start, lte: end },
    },
    select: {
      id: true,
      status: true,
      channel: true,
      category: true,
      assignedTo: true,
      createdAt: true,
      resolvedAt: true,
      firstResponseAt: true,
    },
  })

  // Also get tickets resolved in range (may have been created before)
  const resolvedInRange = await prisma.supportTicket.findMany({
    where: {
      resolvedAt: { gte: start, lte: end },
    },
    select: {
      id: true,
      assignedTo: true,
      resolvedAt: true,
      createdAt: true,
      firstResponseAt: true,
    },
  })

  // Build daily breakdown
  const dailyMap: Record<string, {
    date: string
    opened: number
    resolved: number
    avgResponseMs: number
    responseTimes: number[]
    byStatus: Record<string, number>
    byAgent: Record<string, number>
  }> = {}

  const dayMs = 24 * 60 * 60 * 1000
  const numDays = Math.ceil((end.getTime() - start.getTime()) / dayMs) + 1

  for (let i = 0; i < numDays; i++) {
    const d = new Date(start.getTime() + i * dayMs)
    const dateStr = d.toISOString().split("T")[0]
    dailyMap[dateStr] = {
      date: dateStr,
      opened: 0,
      resolved: 0,
      avgResponseMs: 0,
      responseTimes: [],
      byStatus: {},
      byAgent: {},
    }
  }

  // Opened per day
  for (const t of tickets) {
    const dateStr = new Date(t.createdAt).toISOString().split("T")[0]
    if (dailyMap[dateStr]) {
      dailyMap[dateStr].opened++
      if (t.firstResponseAt) {
        dailyMap[dateStr].responseTimes.push(
          new Date(t.firstResponseAt).getTime() - new Date(t.createdAt).getTime()
        )
      }
    }
  }

  // Resolved per day
  for (const t of resolvedInRange) {
    if (!t.resolvedAt) continue
    const dateStr = new Date(t.resolvedAt).toISOString().split("T")[0]
    if (dailyMap[dateStr]) {
      dailyMap[dateStr].resolved++
      if (t.assignedTo) {
        dailyMap[dateStr].byAgent[t.assignedTo] = (dailyMap[dateStr].byAgent[t.assignedTo] || 0) + 1
      }
    }
  }

  // Calculate avg response times
  for (const day of Object.values(dailyMap)) {
    if (day.responseTimes.length > 0) {
      day.avgResponseMs = day.responseTimes.reduce((a, b) => a + b, 0) / day.responseTimes.length
    }
  }

  // Status distribution by day (current day status count)
  const allCurrentTickets = await prisma.supportTicket.findMany({
    where: {
      createdAt: { gte: start, lte: end },
    },
    select: { status: true, createdAt: true },
  })

  const statusByDay: Record<string, Record<string, number>> = {}
  for (const t of allCurrentTickets) {
    const dateStr = new Date(t.createdAt).toISOString().split("T")[0]
    if (!statusByDay[dateStr]) statusByDay[dateStr] = {}
    statusByDay[dateStr][t.status] = (statusByDay[dateStr][t.status] || 0) + 1
  }

  // Agent comparison (total in range)
  const agentComparison: Record<string, { handled: number; avgResolutionMs: number; resolutionTimes: number[] }> = {}
  for (const t of resolvedInRange) {
    const agent = t.assignedTo || "Unassigned"
    if (!agentComparison[agent]) {
      agentComparison[agent] = { handled: 0, avgResolutionMs: 0, resolutionTimes: [] }
    }
    agentComparison[agent].handled++
    if (t.resolvedAt) {
      agentComparison[agent].resolutionTimes.push(
        new Date(t.resolvedAt).getTime() - new Date(t.createdAt).getTime()
      )
    }
  }
  for (const agent of Object.keys(agentComparison)) {
    const a = agentComparison[agent]
    a.avgResolutionMs = a.resolutionTimes.length > 0
      ? a.resolutionTimes.reduce((x, y) => x + y, 0) / a.resolutionTimes.length
      : 0
  }

  // Top categories
  const categoryCount: Record<string, number> = {}
  for (const t of tickets) {
    const cat = t.category || "general"
    categoryCount[cat] = (categoryCount[cat] || 0) + 1
  }

  const daily = Object.values(dailyMap)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(({ responseTimes, ...rest }) => rest)

  return NextResponse.json({
    daily,
    statusByDay,
    agentComparison,
    categoryCount,
    totalInRange: tickets.length,
    resolvedInRange: resolvedInRange.length,
  })
}
