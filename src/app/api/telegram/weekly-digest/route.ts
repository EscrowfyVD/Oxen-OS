import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendTelegramMessage } from "@/lib/telegram"

// No auth required — called by sync worker cron
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const type = body.type as "monday" | "friday"

    if (!type || !["monday", "friday"].includes(type)) {
      return NextResponse.json({ error: "type must be 'monday' or 'friday'" }, { status: 400 })
    }

    console.log(`[weekly-digest] Generating ${type} digest...`)

    // Find all employees with Telegram linked
    const employees = await prisma.employee.findMany({
      where: {
        telegramChatId: { not: null },
        isActive: true,
      },
      select: { id: true, name: true, email: true, telegramChatId: true, isAdmin: true },
    })

    if (employees.length === 0) {
      return NextResponse.json({ message: "No employees with Telegram linked", sent: 0 })
    }

    const sentTo: string[] = []
    const DEAL_OWNERS = ["Andy", "Paul Louis", "Vernon"]

    if (type === "monday") {
      // ─── Monday Personal Digest for each sales rep ───
      for (const emp of employees) {
        const isDealOwner = DEAL_OWNERS.some((o) => emp.name.toLowerCase().includes(o.toLowerCase()))
        if (!isDealOwner) continue

        try {
          const msg = await buildMondayPersonalDigest(emp.name)
          await sendTelegramMessage(emp.telegramChatId!, msg)
          sentTo.push(emp.name)
          console.log(`[weekly-digest] Sent Monday digest to ${emp.name}`)
        } catch (err) {
          console.error(`[weekly-digest] Failed for ${emp.name}:`, err)
        }
      }

      // ─── Monday Team Overview for admin ───
      for (const emp of employees) {
        if (!emp.isAdmin) continue
        try {
          const msg = await buildMondayTeamDigest()
          await sendTelegramMessage(emp.telegramChatId!, msg)
          sentTo.push(`${emp.name} (team)`)
          console.log(`[weekly-digest] Sent Monday team digest to ${emp.name}`)
        } catch (err) {
          console.error(`[weekly-digest] Team digest failed for ${emp.name}:`, err)
        }
      }
    } else {
      // ─── Friday End-of-Week for each sales rep ───
      for (const emp of employees) {
        const isDealOwner = DEAL_OWNERS.some((o) => emp.name.toLowerCase().includes(o.toLowerCase()))
        if (!isDealOwner) continue

        try {
          const msg = await buildFridayDigest(emp.name)
          await sendTelegramMessage(emp.telegramChatId!, msg)
          sentTo.push(emp.name)
          console.log(`[weekly-digest] Sent Friday digest to ${emp.name}`)
        } catch (err) {
          console.error(`[weekly-digest] Failed for ${emp.name}:`, err)
        }
      }
    }

    console.log(`[weekly-digest] Done. Sent to: ${sentTo.join(", ")}`)
    return NextResponse.json({ type, sent: sentTo.length, sentTo })
  } catch (error) {
    console.error("[weekly-digest] Error:", error)
    return NextResponse.json({ error: "Failed to send weekly digest" }, { status: 500 })
  }
}

// ═══════════════════════════════════════════════════════
//  MONDAY PERSONAL DIGEST
// ═══════════════════════════════════════════════════════

async function buildMondayPersonalDigest(ownerName: string): Promise<string> {
  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1) // Monday
  weekStart.setHours(0, 0, 0, 0)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 5) // Friday
  weekEnd.setHours(23, 59, 59, 999)
  const lastWeekStart = new Date(weekStart)
  lastWeekStart.setDate(lastWeekStart.getDate() - 7)
  const dateStr = now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })

  // Active deals
  const activeDeals = await prisma.deal.findMany({
    where: {
      dealOwner: { contains: ownerName, mode: "insensitive" },
      stage: { notIn: ["closed_won", "closed_lost"] },
    },
    select: { dealValue: true, winProbability: true, stage: true },
  })

  const totalActive = activeDeals.length
  const totalPipeline = activeDeals.reduce((sum, d) => sum + (d.dealValue || 0), 0)
  const weightedPipeline = activeDeals.reduce(
    (sum, d) => sum + (d.dealValue || 0) * (d.winProbability || 0),
    0,
  )

  // New leads this week
  const newLeadsCount = await prisma.crmContact.count({
    where: {
      dealOwner: { contains: ownerName, mode: "insensitive" },
      createdAt: { gte: weekStart },
    },
  })

  // Meetings this week
  let meetingsThisWeek = 0
  try {
    meetingsThisWeek = await prisma.calendarEvent.count({
      where: { startTime: { gte: weekStart, lte: weekEnd } },
    })
  } catch { /* calendar may not exist */ }

  // Last week results
  const dealsWonLastWeek = await prisma.deal.findMany({
    where: {
      dealOwner: { contains: ownerName, mode: "insensitive" },
      stage: "closed_won",
      closedAt: { gte: lastWeekStart, lt: weekStart },
    },
    select: { dealValue: true },
  })
  const dealsLostLastWeek = await prisma.deal.count({
    where: {
      dealOwner: { contains: ownerName, mode: "insensitive" },
      stage: "closed_lost",
      closedAt: { gte: lastWeekStart, lt: weekStart },
    },
  })
  const meetingsLastWeek = await prisma.deal.count({
    where: {
      dealOwner: { contains: ownerName, mode: "insensitive" },
      stage: "meeting_completed",
      stageChangedAt: { gte: lastWeekStart, lt: weekStart },
    },
  })
  const proposalsLastWeek = await prisma.deal.count({
    where: {
      dealOwner: { contains: ownerName, mode: "insensitive" },
      stage: "proposal_sent",
      stageChangedAt: { gte: lastWeekStart, lt: weekStart },
    },
  })
  const wonValue = dealsWonLastWeek.reduce((s, d) => s + (d.dealValue || 0), 0)

  // Needs attention
  const staleDeals = await prisma.deal.count({
    where: {
      dealOwner: { contains: ownerName, mode: "insensitive" },
      stage: { notIn: ["closed_won", "closed_lost"] },
      daysSinceLastActivity: { gte: 7 },
    },
  })
  const overdueTasks = await prisma.task.count({
    where: {
      assignee: { contains: ownerName, mode: "insensitive" },
      column: { not: "done" },
      deadline: { lt: now },
    },
  })

  // Tasks this week
  const tasksThisWeek = await prisma.task.findMany({
    where: {
      assignee: { contains: ownerName, mode: "insensitive" },
      column: { not: "done" },
      deadline: { gte: weekStart, lte: weekEnd },
    },
    orderBy: { deadline: "asc" },
    take: 10,
    select: { title: true, deadline: true },
  })

  // Meetings this week (detailed)
  let meetingsList: Array<{ title: string; startTime: Date; attendees: string[] }> = []
  try {
    meetingsList = await prisma.calendarEvent.findMany({
      where: { startTime: { gte: weekStart, lte: weekEnd } },
      orderBy: { startTime: "asc" },
      take: 10,
      select: { title: true, startTime: true, attendees: true },
    })
  } catch { /* calendar may not exist */ }

  // Build message
  let msg = `\u{1F3DB} <b>Weekly Kickoff \u2014 ${esc(dateStr)}</b>\n\n`

  msg += `\u{1F4CA} <b>Your Pipeline</b>\n`
  msg += `\u2022 Active deals: ${totalActive} (\u20AC${Math.round(weightedPipeline).toLocaleString()} weighted)\n`
  msg += `\u2022 Total pipeline: \u20AC${Math.round(totalPipeline).toLocaleString()}\n`
  msg += `\u2022 New leads this week: ${newLeadsCount}\n`
  msg += `\u2022 Meetings this week: ${meetingsThisWeek}\n\n`

  msg += `\u2705 <b>Last Week Results</b>\n`
  msg += `\u2022 Deals won: ${dealsWonLastWeek.length} (\u20AC${Math.round(wonValue).toLocaleString()})\n`
  msg += `\u2022 Deals lost: ${dealsLostLastWeek}\n`
  msg += `\u2022 Meetings completed: ${meetingsLastWeek}\n`
  msg += `\u2022 Proposals sent: ${proposalsLastWeek}\n\n`

  if (staleDeals > 0 || overdueTasks > 0) {
    msg += `\u26A0\uFE0F <b>Needs Attention</b>\n`
    if (staleDeals > 0) msg += `\u2022 ${staleDeals} deals with no activity in 7+ days\n`
    if (overdueTasks > 0) msg += `\u2022 ${overdueTasks} overdue tasks\n`
    msg += `\n`
  }

  if (tasksThisWeek.length > 0) {
    msg += `\u{1F4CB} <b>Your Tasks This Week</b>\n`
    for (const t of tasksThisWeek) {
      const dl = t.deadline ? new Date(t.deadline).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }) : "no deadline"
      msg += `\u2022 ${esc(t.title)} \u2014 due ${dl}\n`
    }
    msg += `\n`
  }

  if (meetingsList.length > 0) {
    msg += `\u{1F4C5} <b>Your Meetings This Week</b>\n`
    for (const m of meetingsList) {
      const day = new Date(m.startTime).toLocaleDateString("en-GB", { weekday: "short" })
      const time = new Date(m.startTime).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
      const attendeeStr = m.attendees.slice(0, 3).join(", ")
      msg += `\u2022 ${day} ${time} \u2014 ${esc(m.title)} with ${esc(attendeeStr)}\n`
    }
    msg += `\n`
  }

  msg += `Have a great week! \u{1F680}`

  return msg
}

// ═══════════════════════════════════════════════════════
//  MONDAY TEAM DIGEST (admin only)
// ═══════════════════════════════════════════════════════

async function buildMondayTeamDigest(): Promise<string> {
  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1)
  weekStart.setHours(0, 0, 0, 0)
  const lastWeekStart = new Date(weekStart)
  lastWeekStart.setDate(lastWeekStart.getDate() - 7)
  const dateStr = now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })

  // Total pipeline
  const allActiveDeals = await prisma.deal.findMany({
    where: { stage: { notIn: ["closed_won", "closed_lost"] } },
    select: { dealValue: true, dealOwner: true, stage: true },
  })
  const totalDeals = allActiveDeals.length
  const totalValue = allActiveDeals.reduce((s, d) => s + (d.dealValue || 0), 0)

  // New leads
  const newLeads = await prisma.crmContact.count({
    where: { createdAt: { gte: lastWeekStart } },
  })

  // Won/lost last week
  const wonDeals = await prisma.deal.findMany({
    where: { stage: "closed_won", closedAt: { gte: lastWeekStart, lt: weekStart } },
    select: { dealValue: true },
  })
  const lostDeals = await prisma.deal.count({
    where: { stage: "closed_lost", closedAt: { gte: lastWeekStart, lt: weekStart } },
  })
  const wonValue = wonDeals.reduce((s, d) => s + (d.dealValue || 0), 0)

  // Per rep
  const DEAL_OWNERS = ["Andy", "Paul Louis", "Vernon"]
  const repStats: Array<{ name: string; active: number; pipeline: number; meetings: number }> = []

  for (const owner of DEAL_OWNERS) {
    const repDeals = allActiveDeals.filter(
      (d) => d.dealOwner?.toLowerCase().includes(owner.toLowerCase()),
    )
    let meetings = 0
    try {
      meetings = await prisma.calendarEvent.count({
        where: { startTime: { gte: weekStart } },
      })
    } catch { /* silently ignore */ }

    repStats.push({
      name: owner,
      active: repDeals.length,
      pipeline: repDeals.reduce((s, d) => s + (d.dealValue || 0), 0),
      meetings: Math.round(meetings / DEAL_OWNERS.length), // rough split
    })
  }

  // Alerts
  const staleTotal = await prisma.deal.count({
    where: {
      stage: { notIn: ["closed_won", "closed_lost"] },
      daysSinceLastActivity: { gte: 7 },
    },
  })
  const overdueTotal = await prisma.task.count({
    where: { column: { not: "done" }, deadline: { lt: now } },
  })
  const openTickets = await prisma.supportTicket.count({
    where: { status: { in: ["open", "in_progress"] } },
  })

  // Pipeline vs last week (rough: check deals created last week)
  const lastWeekValue = await prisma.deal.aggregate({
    where: {
      stage: { notIn: ["closed_won", "closed_lost"] },
      createdAt: { lt: weekStart },
    },
    _sum: { dealValue: true },
  })
  const pipelineDelta = totalValue - (lastWeekValue._sum.dealValue || 0)

  // Win rate this month
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const wonThisMonth = await prisma.deal.count({
    where: { stage: "closed_won", closedAt: { gte: monthStart } },
  })
  const lostThisMonth = await prisma.deal.count({
    where: { stage: "closed_lost", closedAt: { gte: monthStart } },
  })
  const winRate = wonThisMonth + lostThisMonth > 0
    ? Math.round((wonThisMonth / (wonThisMonth + lostThisMonth)) * 100)
    : 0

  let msg = `\u{1F3DB} <b>Team Weekly Overview \u2014 ${esc(dateStr)}</b>\n\n`

  msg += `\u{1F4CA} <b>Pipeline</b>\n`
  msg += `\u2022 Total active deals: ${totalDeals} (\u20AC${Math.round(totalValue).toLocaleString()})\n`
  msg += `\u2022 New leads: ${newLeads}\n`
  msg += `\u2022 Deals won last week: ${wonDeals.length} (\u20AC${Math.round(wonValue).toLocaleString()})\n`
  msg += `\u2022 Deals lost last week: ${lostDeals}\n\n`

  msg += `\u{1F465} <b>Per Rep</b>\n`
  for (const r of repStats) {
    msg += `\u2022 ${r.name}: ${r.active} deals, \u20AC${Math.round(r.pipeline).toLocaleString()} pipeline\n`
  }
  msg += `\n`

  if (staleTotal > 0 || overdueTotal > 0 || openTickets > 0) {
    msg += `\u26A0\uFE0F <b>Alerts</b>\n`
    if (staleTotal > 0) msg += `\u2022 ${staleTotal} stale deals across team\n`
    if (overdueTotal > 0) msg += `\u2022 ${overdueTotal} overdue tasks\n`
    if (openTickets > 0) msg += `\u2022 ${openTickets} support tickets open\n`
    msg += `\n`
  }

  msg += `\u{1F4C8} <b>Trends</b>\n`
  msg += `\u2022 Pipeline vs last week: ${pipelineDelta >= 0 ? "+" : ""}\u20AC${Math.round(pipelineDelta).toLocaleString()}\n`
  msg += `\u2022 Win rate this month: ${winRate}%\n`

  return msg
}

// ═══════════════════════════════════════════════════════
//  FRIDAY END-OF-WEEK DIGEST
// ═══════════════════════════════════════════════════════

async function buildFridayDigest(ownerName: string): Promise<string> {
  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1) // Monday
  weekStart.setHours(0, 0, 0, 0)
  const weekEndStr = now.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
  const weekStartStr = weekStart.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
  const DEAL_OWNERS = ["Andy", "Paul Louis", "Vernon"]

  // Deals moved forward this week
  const dealsMoved = await prisma.deal.count({
    where: {
      dealOwner: { contains: ownerName, mode: "insensitive" },
      stageChangedAt: { gte: weekStart },
    },
  })

  // Meetings completed
  let meetingsCompleted = 0
  try {
    meetingsCompleted = await prisma.calendarEvent.count({
      where: {
        startTime: { gte: weekStart, lt: now },
      },
    })
  } catch { /* silently ignore */ }

  // Tasks
  const tasksCompleted = await prisma.task.count({
    where: {
      assignee: { contains: ownerName, mode: "insensitive" },
      column: "done",
      updatedAt: { gte: weekStart },
    },
  })
  const tasksTotal = await prisma.task.count({
    where: {
      assignee: { contains: ownerName, mode: "insensitive" },
      createdAt: { gte: weekStart },
    },
  })

  // Emails sent/received
  let emailsSent = 0
  let emailsReceived = 0
  try {
    emailsSent = await prisma.email.count({
      where: { direction: "outbound", date: { gte: weekStart } },
    })
    emailsReceived = await prisma.email.count({
      where: { direction: "inbound", date: { gte: weekStart } },
    })
  } catch { /* email table may not exist */ }

  // Wins this week
  const winsThisWeek = await prisma.deal.findMany({
    where: {
      dealOwner: { contains: ownerName, mode: "insensitive" },
      stage: "closed_won",
      closedAt: { gte: weekStart },
    },
    select: { dealName: true, dealValue: true },
  })

  // Meetings booked this week
  const meetingsBooked = await prisma.deal.count({
    where: {
      dealOwner: { contains: ownerName, mode: "insensitive" },
      stage: "meeting_booked",
      stageChangedAt: { gte: weekStart },
    },
  })

  // Carry over
  const overdueTasks = await prisma.task.count({
    where: {
      assignee: { contains: ownerName, mode: "insensitive" },
      column: { not: "done" },
      deadline: { lt: now },
    },
  })
  const staleDeals = await prisma.deal.count({
    where: {
      dealOwner: { contains: ownerName, mode: "insensitive" },
      stage: { notIn: ["closed_won", "closed_lost"] },
      daysSinceLastActivity: { gte: 7 },
    },
  })

  // Team leaderboard
  const leaderboard: Array<{ name: string; moved: number }> = []
  for (const owner of DEAL_OWNERS) {
    const moved = await prisma.deal.count({
      where: {
        dealOwner: { contains: owner, mode: "insensitive" },
        stageChangedAt: { gte: weekStart },
      },
    })
    leaderboard.push({ name: owner, moved })
  }
  leaderboard.sort((a, b) => b.moved - a.moved)
  const medals = ["\u{1F947}", "\u{1F948}", "\u{1F949}"]

  // Build message
  let msg = `\u{1F3DB} <b>Week in Review \u2014 ${weekStartStr} to ${weekEndStr}</b>\n\n`

  msg += `\u{1F4C8} <b>Your Performance</b>\n`
  msg += `\u2022 Deals moved forward: ${dealsMoved}\n`
  msg += `\u2022 Meetings completed: ${meetingsCompleted}\n`
  msg += `\u2022 Tasks completed: ${tasksCompleted} / ${tasksTotal} total\n`
  if (emailsSent > 0 || emailsReceived > 0) {
    msg += `\u2022 Emails sent: ${emailsSent}, Received: ${emailsReceived}\n`
  }
  msg += `\n`

  if (winsThisWeek.length > 0 || meetingsBooked > 0) {
    msg += `\u{1F3C6} <b>Wins</b>\n`
    for (const w of winsThisWeek) {
      msg += `\u2022 Deal won: ${esc(w.dealName)} (\u20AC${(w.dealValue || 0).toLocaleString()})\n`
    }
    if (meetingsBooked > 0) msg += `\u2022 ${meetingsBooked} new meetings booked\n`
    msg += `\n`
  }

  if (overdueTasks > 0 || staleDeals > 0) {
    msg += `\u26A0\uFE0F <b>Carry Over to Next Week</b>\n`
    if (overdueTasks > 0) msg += `\u2022 ${overdueTasks} overdue tasks\n`
    if (staleDeals > 0) msg += `\u2022 ${staleDeals} stale deals\n`
    msg += `\n`
  }

  msg += `\u{1F4CA} <b>Team Leaderboard</b>\n`
  for (let i = 0; i < leaderboard.length; i++) {
    const medal = medals[i] || "  "
    msg += `${medal} ${leaderboard[i].name} \u2014 ${leaderboard[i].moved} deals moved\n`
  }
  msg += `\n`

  msg += `Enjoy your weekend! \u{1F31F}`

  return msg
}

// ─── HTML escape helper ─────────────────────────────────

function esc(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}
