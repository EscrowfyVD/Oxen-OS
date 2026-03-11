import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const dateFrom = searchParams.get("dateFrom")
  const dateTo = searchParams.get("dateTo")

  const dateFilter: Record<string, unknown> = {}
  if (dateFrom || dateTo) {
    dateFilter.createdAt = {
      ...(dateFrom && { gte: new Date(dateFrom) }),
      ...(dateTo && { lte: new Date(dateTo + "T23:59:59Z") }),
    }
  }

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const weekStart = new Date(todayStart)
  weekStart.setDate(weekStart.getDate() - weekStart.getDay())

  // All tickets in range
  const tickets = await prisma.supportTicket.findMany({
    where: dateFilter,
    select: {
      id: true,
      status: true,
      priority: true,
      channel: true,
      category: true,
      assignedTo: true,
      createdAt: true,
      resolvedAt: true,
      firstResponseAt: true,
    },
  })

  // Open tickets (always current, not affected by date filter)
  const openCount = await prisma.supportTicket.count({
    where: { status: { in: ["open", "in_progress"] } },
  })

  // Resolved today
  const resolvedToday = await prisma.supportTicket.count({
    where: {
      resolvedAt: { gte: todayStart },
    },
  })

  // Avg response time (ms)
  const ticketsWithResponse = tickets.filter((t) => t.firstResponseAt)
  const avgResponseMs = ticketsWithResponse.length > 0
    ? ticketsWithResponse.reduce((sum, t) => sum + (new Date(t.firstResponseAt!).getTime() - new Date(t.createdAt).getTime()), 0) / ticketsWithResponse.length
    : 0

  // Avg resolution time (ms)
  const ticketsResolved = tickets.filter((t) => t.resolvedAt)
  const avgResolutionMs = ticketsResolved.length > 0
    ? ticketsResolved.reduce((sum, t) => sum + (new Date(t.resolvedAt!).getTime() - new Date(t.createdAt).getTime()), 0) / ticketsResolved.length
    : 0

  // Resolution rate
  const resolutionRate = tickets.length > 0
    ? (ticketsResolved.length / tickets.length) * 100
    : 0

  // By channel
  const byChannel: Record<string, number> = {}
  for (const t of tickets) {
    byChannel[t.channel] = (byChannel[t.channel] || 0) + 1
  }

  // By category
  const byCategory: Record<string, number> = {}
  for (const t of tickets) {
    const cat = t.category || "general"
    byCategory[cat] = (byCategory[cat] || 0) + 1
  }

  // By status
  const byStatus: Record<string, number> = {}
  for (const t of tickets) {
    byStatus[t.status] = (byStatus[t.status] || 0) + 1
  }

  // By agent (this week for team performance)
  const weekTickets = await prisma.supportTicket.findMany({
    where: { createdAt: { gte: weekStart } },
    select: { assignedTo: true, status: true, resolvedAt: true, firstResponseAt: true, createdAt: true },
  })

  const agentStats: Record<string, {
    assigned: number
    resolved: number
    avgResponseMs: number
    avgResolutionMs: number
    responseTimes: number[]
    resolutionTimes: number[]
  }> = {}

  for (const t of weekTickets) {
    const agent = t.assignedTo || "Unassigned"
    if (!agentStats[agent]) {
      agentStats[agent] = { assigned: 0, resolved: 0, avgResponseMs: 0, avgResolutionMs: 0, responseTimes: [], resolutionTimes: [] }
    }
    agentStats[agent].assigned++
    if (t.resolvedAt) {
      agentStats[agent].resolved++
      agentStats[agent].resolutionTimes.push(new Date(t.resolvedAt).getTime() - new Date(t.createdAt).getTime())
    }
    if (t.firstResponseAt) {
      agentStats[agent].responseTimes.push(new Date(t.firstResponseAt).getTime() - new Date(t.createdAt).getTime())
    }
  }

  // Calculate averages
  for (const agent of Object.keys(agentStats)) {
    const s = agentStats[agent]
    s.avgResponseMs = s.responseTimes.length > 0
      ? s.responseTimes.reduce((a, b) => a + b, 0) / s.responseTimes.length
      : 0
    s.avgResolutionMs = s.resolutionTimes.length > 0
      ? s.resolutionTimes.reduce((a, b) => a + b, 0) / s.resolutionTimes.length
      : 0
  }

  // Recent activity (last 10 resolved/status changes)
  const recentTickets = await prisma.supportTicket.findMany({
    orderBy: { updatedAt: "desc" },
    take: 10,
    select: {
      id: true,
      subject: true,
      status: true,
      category: true,
      assignedTo: true,
      updatedAt: true,
    },
  })

  // Agent daily resolved (last 7 days) for sparklines
  const sevenDaysAgo = new Date(todayStart)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const recentResolved = await prisma.supportTicket.findMany({
    where: {
      resolvedAt: { gte: sevenDaysAgo },
      assignedTo: { not: null },
    },
    select: { assignedTo: true, resolvedAt: true },
  })

  const agentDailyResolved: Record<string, number[]> = {}
  for (const t of recentResolved) {
    const agent = t.assignedTo!
    if (!agentDailyResolved[agent]) agentDailyResolved[agent] = new Array(7).fill(0)
    const dayIdx = Math.floor((new Date(t.resolvedAt!).getTime() - sevenDaysAgo.getTime()) / (24 * 60 * 60 * 1000))
    if (dayIdx >= 0 && dayIdx < 7) agentDailyResolved[agent][dayIdx]++
  }

  return NextResponse.json({
    stats: {
      total: tickets.length,
      openCount,
      resolvedToday,
      avgResponseMs,
      avgResolutionMs,
      resolutionRate,
      byChannel,
      byCategory,
      byStatus,
      agentStats,
      agentDailyResolved,
      recentActivity: recentTickets,
    },
  })
}
