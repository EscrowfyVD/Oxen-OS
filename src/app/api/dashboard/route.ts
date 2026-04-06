import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getUserRole } from "@/lib/admin"
import { canAccess, type RoleLevel } from "@/lib/permissions"

const ACTION_META: Record<string, { icon: string; color: string }> = {
  client_onboarded: { icon: "\uD83E\uDD1D", color: "#34D399" },
  agent_created: { icon: "\uD83D\uDC64", color: "#818CF8" },
  employee_joined: { icon: "\uD83D\uDC65", color: "#6B8BC0" },
  meeting_summary: { icon: "\uD83D\uDCCB", color: "#FBBF24" },
  task_completed: { icon: "\u2705", color: "#34D399" },
  task_created: { icon: "\u2611\uFE0F", color: "#818CF8" },
  wiki_updated: { icon: "\uD83D\uDCDD", color: "#C08B88" },
  sentinel_insight: { icon: "\uD83D\uDEE1", color: "#F87171" },
  contact_created: { icon: "\uD83D\uDCBC", color: "#6BC0B8" },
  callnote_generated: { icon: "\uD83D\uDCCB", color: "#FBBF24" },
}

export async function GET() {
  const { session, employee, roleLevel } = await getUserRole()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const userEmail = session.user.email?.toLowerCase() ?? ""
  const isAdmin = canAccess(roleLevel, "admin")
  const isManager = canAccess(roleLevel, "manager")

  // ── 1. KPI Stats ──
  const now2 = new Date()
  const monthStart = new Date(now2.getFullYear(), now2.getMonth(), 1)
  const monthEnd = new Date(now2.getFullYear(), now2.getMonth() + 1, 1)

  const [activeClients, pipelineAgg, monthlyVolumeAgg, userTasks] = await Promise.all([
    // Active clients = contacts whose lifecycleStage is "client" (set when deal is closed_won)
    prisma.crmContact.count({ where: { lifecycleStage: "client" } }),
    prisma.deal.aggregate({
      where: { stage: { notIn: ["closed_won", "closed_lost"] } },
      _sum: { dealValue: true },
    }),
    // Monthly volume = sum of dealValue for deals closed_won this month
    prisma.deal.aggregate({
      where: {
        stage: "closed_won",
        updatedAt: { gte: monthStart, lt: monthEnd },
      },
      _sum: { dealValue: true },
    }),
    // Safe query: when employee is null, count all open tasks (no assignee filter)
    prisma.task.count({
      where: {
        column: { in: ["todo", "inprogress"] },
        ...(employee?.name
          ? { assignee: { contains: employee.name, mode: "insensitive" as const } }
          : {}),
      },
    }),
  ])

  const stats = {
    activeClients: activeClients ?? 0,
    pipelineValue: pipelineAgg._sum.dealValue ?? 0,
    monthlyVolume: monthlyVolumeAgg._sum.dealValue ?? 0,
    userOpenTasks: userTasks ?? 0,
  }

  // ── 2. Recent Activity (last 15) ──
  const activities = await prisma.activityLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 15,
  })

  const activityFeed = activities.map((a) => {
    const meta = ACTION_META[a.action] || { icon: "\uD83D\uDD14", color: "#C08B88" }
    return {
      id: a.id,
      action: a.action,
      detail: a.detail,
      icon: meta.icon,
      color: meta.color,
      link: a.link,
      createdAt: a.createdAt.toISOString(),
    }
  })

  // ── 3. Today's Schedule ──
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const todayEnd = new Date(todayStart)
  todayEnd.setDate(todayEnd.getDate() + 1)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scheduleWhere: any = {
    startTime: { gte: todayStart, lt: todayEnd },
  }

  if (!isAdmin) {
    if (isManager && employee?.id) {
      // Manager: own events + direct reports' events
      const reportEmails = await prisma.employee.findMany({
        where: { managerId: employee.id },
        select: { email: true },
      })
      const teamEmails = [userEmail, ...reportEmails.map((r) => r.email?.toLowerCase()).filter(Boolean)] as string[]
      scheduleWhere.OR = [
        { calendarOwner: { in: teamEmails } },
        { attendees: { hasSome: teamEmails } },
      ]
    } else {
      // Regular member: only own events
      scheduleWhere.OR = [
        { calendarOwner: { equals: userEmail, mode: "insensitive" } },
        { attendees: { has: userEmail } },
      ]
    }
  }

  const events = await prisma.calendarEvent.findMany({
    where: scheduleWhere,
    orderBy: { startTime: "asc" },
    select: {
      id: true,
      title: true,
      startTime: true,
      endTime: true,
      attendees: true,
      location: true,
      meetLink: true,
      calendarOwner: true,
    },
  })

  // Resolve attendee avatars
  const allAttendeeEmails = [...new Set(events.flatMap((e) => e.attendees))]
  const attendeeEmployees = await prisma.employee.findMany({
    where: { email: { in: allAttendeeEmails, mode: "insensitive" } },
    select: { email: true, name: true, initials: true, avatarColor: true, icon: true },
  })
  const emailToEmployee = new Map(
    attendeeEmployees.map((e) => [e.email?.toLowerCase(), e])
  )

  const schedule = events.map((e) => ({
    id: e.id,
    title: e.title,
    startTime: e.startTime.toISOString(),
    endTime: e.endTime.toISOString(),
    location: e.location,
    meetLink: e.meetLink,
    attendees: e.attendees.map((email) => {
      const emp = emailToEmployee.get(email.toLowerCase())
      return emp
        ? { email, name: emp.name, initials: emp.initials, avatarColor: emp.avatarColor, icon: emp.icon }
        : { email, name: email.split("@")[0], initials: email.slice(0, 2).toUpperCase(), avatarColor: null, icon: null }
    }),
  }))

  const scheduleLabel = isAdmin
    ? "Team Schedule Today"
    : isManager
      ? "Team Schedule Today"
      : "My Schedule Today"

  // ── 4. Quick Actions by role ──
  type QuickAction = { icon: string; label: string; href: string; modal?: string }
  let quickActions: QuickAction[]

  if (isAdmin) {
    quickActions = [
      { icon: "\uD83D\uDCCB", label: "Prepare Call Notes", href: "/calendar" },
      { icon: "\uD83D\uDC64", label: "Add Contact", href: "#", modal: "contact" },
      { icon: "\u2611\uFE0F", label: "Create Task", href: "#", modal: "task" },
      { icon: "\uD83D\uDCD6", label: "New Wiki Page", href: "/wiki/new" },
    ]
  } else if (isManager) {
    quickActions = [
      { icon: "\uD83D\uDC64", label: "Add Contact", href: "#", modal: "contact" },
      { icon: "\u2611\uFE0F", label: "Create Task", href: "#", modal: "task" },
      { icon: "\uD83D\uDCC5", label: "View Calendar", href: "/calendar" },
      { icon: "\uD83E\uDD1D", label: "Add Agent", href: "#", modal: "agent" },
    ]
  } else {
    quickActions = [
      { icon: "\u2611\uFE0F", label: "Create Task", href: "#", modal: "task" },
      { icon: "\uD83D\uDCC5", label: "View Calendar", href: "/calendar" },
      { icon: "\uD83D\uDCD6", label: "Browse Wiki", href: "/wiki" },
      { icon: "\uD83C\uDFD6\uFE0F", label: "Request Leave", href: "/absences" },
    ]
  }

  return NextResponse.json({
    stats,
    activityFeed,
    schedule,
    scheduleLabel,
    quickActions,
    role: roleLevel,
  })
}
