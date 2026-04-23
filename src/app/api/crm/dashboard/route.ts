import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { PIPELINE_STAGES } from "@/lib/crm-config"
import { serializeMoney } from "@/lib/decimal"

// ─── Date helpers ───

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
}

function startOfWeek(d: Date): Date {
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day // Monday
  const mon = new Date(d)
  mon.setDate(d.getDate() + diff)
  return startOfDay(mon)
}

function endOfWeek(d: Date): Date {
  const start = startOfWeek(d)
  const sun = new Date(start)
  sun.setDate(start.getDate() + 6)
  return endOfDay(sun)
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)
}

// ─── GET /api/crm/dashboard ───

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const owner = searchParams.get("owner") || null

  const now = new Date()
  const today = startOfDay(now)
  const todayEnd = endOfDay(now)
  const weekStart = startOfWeek(now)
  const weekEnd = endOfWeek(now)

  const thisMonthStart = startOfMonth(now)
  const thisMonthEnd = endOfMonth(now)
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastMonthStart = startOfMonth(lastMonthDate)
  const lastMonthEnd = endOfMonth(lastMonthDate)

  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const nextWeek = new Date(today)
  nextWeek.setDate(nextWeek.getDate() + 7)

  // ── Base filters ──

  const dealOwnerFilter = owner ? { dealOwner: owner } : {}
  const taskAssigneeFilter = owner ? { assignee: owner } : {}
  const closedStages = ["closed_won", "closed_lost"]

  // ── KPIs ──

  const INTERNAL_TITLE_PATTERNS = /team call|internal|standup|stand-up/i

  const [activeDeals, pipelineAgg, calendarEventsRaw, overdueTasks] =
    await Promise.all([
      // Active deals count
      prisma.deal.count({
        where: {
          ...dealOwnerFilter,
          stage: { notIn: closedStages },
        },
      }),

      // Pipeline value (sum of weightedValue for active deals)
      prisma.deal.aggregate({
        _sum: { weightedValue: true },
        where: {
          ...dealOwnerFilter,
          stage: { notIn: closedStages },
        },
      }),

      // Calendar events this week — fetched for in-memory filtering
      prisma.calendarEvent.findMany({
        where: {
          startTime: { gte: weekStart, lte: weekEnd },
        },
        select: { title: true, attendees: true },
      }),

      // Overdue tasks
      prisma.crmTask.count({
        where: {
          ...taskAssigneeFilter,
          status: { not: "completed" },
          dueDate: { lt: today },
        },
      }),
    ])

  // Only count external meetings:
  //  - Exclude events whose title matches internal patterns
  //  - Keep only events with at least one non-@oxen.finance attendee
  const meetingsThisWeek = calendarEventsRaw.filter((event) => {
    if (INTERNAL_TITLE_PATTERNS.test(event.title)) return false
    const hasExternalAttendee = event.attendees.some(
      (email) => !email.toLowerCase().endsWith("@oxen.finance")
    )
    return hasExternalAttendee
  }).length

  const kpis = {
    activeDeals,
    // Sprint 3.2 — serialize Decimal aggregate for JSON.
    pipelineValue: serializeMoney(pipelineAgg._sum.weightedValue) ?? 0,
    meetingsThisWeek,
    overdueTasks,
  }

  // ── Funnel (one entry per pipeline stage) ──

  const funnelData = await prisma.deal.groupBy({
    by: ["stage"],
    _count: { id: true },
    _sum: { dealValue: true },
    where: dealOwnerFilter,
  })

  // Sprint 3.2 — serialize Decimal aggregates once per stage.
  const funnelMap = new Map(
    funnelData.map((f) => [
      f.stage,
      { count: f._count.id, value: serializeMoney(f._sum.dealValue) ?? 0 },
    ])
  )

  const funnel = PIPELINE_STAGES.map((s) => ({
    stageId: s.id,
    label: s.label,
    count: funnelMap.get(s.id)?.count ?? 0,
    value: funnelMap.get(s.id)?.value ?? 0,
    color: s.color,
  }))

  // ── Tasks Today ──

  const taskSelect = {
    id: true,
    title: true,
    type: true,
    dueDate: true,
    status: true,
    assignee: true,
    priority: true,
    contact: { select: { id: true, firstName: true, lastName: true } },
    deal: { select: { id: true, dealName: true } },
  }

  const [overdueTasks_, dueTodayTasks, upcomingTasks] = await Promise.all([
    prisma.crmTask.findMany({
      where: {
        ...taskAssigneeFilter,
        status: { not: "completed" },
        dueDate: { lt: today },
      },
      select: taskSelect,
      orderBy: { dueDate: "asc" },
    }),

    prisma.crmTask.findMany({
      where: {
        ...taskAssigneeFilter,
        status: { not: "completed" },
        dueDate: { gte: today, lte: todayEnd },
      },
      select: taskSelect,
      orderBy: { dueDate: "asc" },
    }),

    prisma.crmTask.findMany({
      where: {
        ...taskAssigneeFilter,
        status: { not: "completed" },
        dueDate: { gt: todayEnd, lte: endOfDay(nextWeek) },
      },
      select: taskSelect,
      orderBy: { dueDate: "asc" },
    }),
  ])

  const tasksToday = {
    overdue: overdueTasks_,
    dueToday: dueTodayTasks,
    upcoming: upcomingTasks,
  }

  // ── Recent Activity ──

  const activityWhere = owner
    ? {
        OR: [
          { deal: { dealOwner: owner } },
          { contact: { deals: { some: { dealOwner: owner } } } },
        ],
      }
    : {}

  const recentActivity = await prisma.activity.findMany({
    where: activityWhere,
    include: {
      contact: { select: { id: true, firstName: true, lastName: true } },
      deal: { select: { id: true, dealName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 15,
  })

  // ── Stale Deals + Follow-up Count + At-Risk Deals ──

  const [staleDeals, followUpCount, atRiskDeals] = await Promise.all([
    prisma.deal.findMany({
      where: {
        ...dealOwnerFilter,
        stage: { notIn: closedStages },
        daysSinceLastActivity: { gte: 7 },
      },
      select: {
        id: true,
        dealName: true,
        dealValue: true,
        stage: true,
        daysSinceLastActivity: true,
        dealOwner: true,
        contact: {
          select: {
            firstName: true,
            lastName: true,
            company: { select: { name: true } },
          },
        },
      },
      orderBy: { daysSinceLastActivity: "desc" },
      take: 10,
    }),

    // Pending AI follow-ups
    prisma.aIFollowUp.count({
      where: {
        status: "pending",
        ...(owner ? { assignee: owner } : {}),
      },
    }),

    // At-risk deals
    prisma.deal.findMany({
      where: {
        ...dealOwnerFilter,
        stage: { notIn: closedStages },
        aiDealHealth: "at_risk",
      },
      select: {
        id: true,
        dealName: true,
        dealValue: true,
        aiDealHealth: true,
        aiDealHealthReason: true,
        daysSinceLastActivity: true,
        contact: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { daysSinceLastActivity: "desc" },
      take: 10,
    }),
  ])

  // ── Performance (this month vs last month) ──

  async function getMonthPerformance(monthStart: Date, monthEnd: Date) {
    const dealCreatedFilter = owner
      ? { ...dealOwnerFilter, createdAt: { gte: monthStart, lte: monthEnd } }
      : { createdAt: { gte: monthStart, lte: monthEnd } }

    const activityMonthFilter = owner
      ? {
          createdAt: { gte: monthStart, lte: monthEnd },
          OR: [
            { deal: { dealOwner: owner } },
            { contact: { deals: { some: { dealOwner: owner } } } },
          ],
        }
      : { createdAt: { gte: monthStart, lte: monthEnd } }

    const closedFilter = (stage: string) =>
      owner
        ? {
            ...dealOwnerFilter,
            stage,
            closedAt: { gte: monthStart, lte: monthEnd },
          }
        : { stage, closedAt: { gte: monthStart, lte: monthEnd } }

    const [
      dealsCreated,
      meetingsBooked,
      proposalsSent,
      dealsWon,
      dealsLost,
      revenueAgg,
    ] = await Promise.all([
      prisma.deal.count({ where: dealCreatedFilter }),
      prisma.activity.count({
        where: {
          ...activityMonthFilter,
          type: { in: ["meeting_calendly", "meeting_manual"] },
        },
      }),
      prisma.activity.count({
        where: {
          ...activityMonthFilter,
          type: "proposal_sent",
        },
      }),
      prisma.deal.count({ where: closedFilter("closed_won") }),
      prisma.deal.count({ where: closedFilter("closed_lost") }),
      prisma.deal.aggregate({
        _sum: { dealValue: true },
        where: closedFilter("closed_won"),
      }),
    ])

    return {
      dealsCreated,
      meetingsBooked,
      proposalsSent,
      dealsWon,
      dealsLost,
      // Sprint 3.2 — serialize Decimal aggregate for JSON.
      revenue: serializeMoney(revenueAgg._sum.dealValue) ?? 0,
    }
  }

  const [thisMonth, lastMonth] = await Promise.all([
    getMonthPerformance(thisMonthStart, thisMonthEnd),
    getMonthPerformance(lastMonthStart, lastMonthEnd),
  ])

  const performance = { thisMonth, lastMonth }

  // Sprint 3.2 — serialize Decimal fields on nested deal objects for JSON.
  return NextResponse.json({
    kpis,
    funnel,
    tasksToday,
    recentActivity,
    staleDeals: staleDeals.map((d) => ({ ...d, dealValue: serializeMoney(d.dealValue) })),
    followUpCount,
    atRiskDeals: atRiskDeals.map((d) => ({
      id: d.id,
      dealName: d.dealName,
      dealValue: serializeMoney(d.dealValue),
      aiDealHealth: d.aiDealHealth,
      aiDealHealthReason: d.aiDealHealthReason,
      contactName: d.contact
        ? `${d.contact.firstName} ${d.contact.lastName}`.trim()
        : null,
      daysSinceLastActivity: d.daysSinceLastActivity,
    })),
    performance,
  })
}
