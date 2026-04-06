import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]

/**
 * Compute the exact next run datetime for a recurring research
 * using scheduledDay and scheduledTime when available, falling back to simple offsets.
 */
function computeNextRunAt(
  from: Date,
  frequency: string,
  scheduledDay: string | null,
  scheduledTime: string | null,
): Date {
  // Parse time (default 09:00)
  const [hours, minutes] = (scheduledTime || "09:00").split(":").map(Number)

  if (frequency === "daily") {
    const next = new Date(from)
    next.setDate(next.getDate() + 1)
    next.setHours(hours, minutes, 0, 0)
    return next
  }

  if (frequency === "weekly" || frequency === "biweekly") {
    const targetDayIndex = scheduledDay ? DAY_NAMES.indexOf(scheduledDay.toLowerCase()) : -1
    const next = new Date(from)
    if (targetDayIndex >= 0) {
      // Advance to the next occurrence of the target day
      const currentDay = next.getDay()
      let daysUntil = targetDayIndex - currentDay
      if (daysUntil <= 0) daysUntil += 7
      if (frequency === "biweekly") daysUntil += 7
      next.setDate(next.getDate() + daysUntil)
    } else {
      next.setDate(next.getDate() + (frequency === "biweekly" ? 14 : 7))
    }
    next.setHours(hours, minutes, 0, 0)
    return next
  }

  if (frequency === "monthly") {
    const targetDay = scheduledDay ? parseInt(scheduledDay, 10) : null
    const next = new Date(from)
    next.setMonth(next.getMonth() + 1)
    if (targetDay && targetDay >= 1 && targetDay <= 28) {
      next.setDate(targetDay)
    }
    next.setHours(hours, minutes, 0, 0)
    return next
  }

  // Fallback: 7 days
  return new Date(from.getTime() + 604800000)
}

export async function GET(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const category = searchParams.get("category")
  const type = searchParams.get("type")
  const status = searchParams.get("status")
  const showArchived = searchParams.get("showArchived") === "true"

  const where: Record<string, unknown> = {}
  if (category && category !== "all") where.category = category
  if (type) where.type = type
  if (status) where.status = status
  if (!showArchived) where.archived = false

  const researches = await prisma.intelResearch.findMany({
    where,
    include: { results: { select: { id: true }, take: 0 } },
    orderBy: { createdAt: "desc" },
  })

  // Get result counts
  const withCounts = await Promise.all(
    researches.map(async (r) => {
      const resultCount = await prisma.intelResult.count({ where: { researchId: r.id } })
      const unreadCount = await prisma.intelResult.count({ where: { researchId: r.id, read: false } })
      return { ...r, resultCount, unreadCount }
    })
  )

  // Sort: active recurring first, then by lastRunAt desc, then createdAt desc
  withCounts.sort((a, b) => {
    // Active recurring first
    const aScore = a.type === "recurring" && a.status === "active" ? 0 : 1
    const bScore = b.type === "recurring" && b.status === "active" ? 0 : 1
    if (aScore !== bScore) return aScore - bScore
    // Then by lastRunAt desc
    const aRun = a.lastRunAt ? new Date(a.lastRunAt).getTime() : 0
    const bRun = b.lastRunAt ? new Date(b.lastRunAt).getTime() : 0
    if (aRun !== bRun) return bRun - aRun
    // Then by createdAt desc
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  return NextResponse.json({ researches: withCounts })
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const { title, category, subcategory, query, type, frequency, sources, keywords, companies, regions, language, scheduledDay, scheduledTime } = body

  if (!title || !category || !type) {
    return NextResponse.json({ error: "title, category, and type are required" }, { status: 400 })
  }

  // Duplicate detection: check for same title + category (case-insensitive)
  const existing = await prisma.intelResearch.findFirst({
    where: {
      title: { equals: title, mode: "insensitive" },
      category,
      archived: false,
    },
  })

  if (existing) {
    return NextResponse.json(
      { error: "duplicate", message: `A research with title "${title}" already exists in ${category}. Use Re-run instead.`, existingId: existing.id },
      { status: 409 }
    )
  }

  const now = new Date()
  let nextRunAt: Date | null = null
  if (type === "recurring" && frequency) {
    nextRunAt = computeNextRunAt(now, frequency, scheduledDay || null, scheduledTime || null)
  }

  const research = await prisma.intelResearch.create({
    data: {
      title,
      category,
      subcategory: subcategory || null,
      query: query || null,
      sources: Array.isArray(sources) ? sources : [],
      keywords: Array.isArray(keywords) ? keywords : [],
      companies: Array.isArray(companies) ? companies : [],
      regions: Array.isArray(regions) ? regions : [],
      language: language || "english",
      type,
      frequency: type === "recurring" ? frequency : null,
      scheduledDay: type === "recurring" ? (scheduledDay || null) : null,
      scheduledTime: type === "recurring" ? (scheduledTime || null) : null,
      nextRunAt,
      createdBy: session.user?.email ?? "unknown",
    },
  })

  return NextResponse.json({ research })
}

// DELETE: bulk operations
export async function DELETE(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const { action, ids } = body

  if (action === "delete_completed") {
    // Delete all completed one-time researches
    const completed = await prisma.intelResearch.findMany({
      where: { status: "completed" },
      select: { id: true },
    })
    const completedIds = completed.map((r) => r.id)
    await prisma.intelResult.deleteMany({ where: { researchId: { in: completedIds } } })
    await prisma.intelResearch.deleteMany({ where: { id: { in: completedIds } } })
    return NextResponse.json({ deleted: completedIds.length })
  }

  if (action === "bulk_delete" && Array.isArray(ids)) {
    await prisma.intelResult.deleteMany({ where: { researchId: { in: ids } } })
    await prisma.intelResearch.deleteMany({ where: { id: { in: ids } } })
    return NextResponse.json({ deleted: ids.length })
  }

  if (action === "archive" && Array.isArray(ids)) {
    await prisma.intelResearch.updateMany({
      where: { id: { in: ids } },
      data: { archived: true, status: "archived" },
    })
    return NextResponse.json({ archived: ids.length })
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 })
}
