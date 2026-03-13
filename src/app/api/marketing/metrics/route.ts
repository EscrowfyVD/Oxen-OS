import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"

export async function GET(request: Request) {
  const { error } = await requirePageAccess("marketing")
  if (error) return error

  const { searchParams } = new URL(request.url)
  const platform = searchParams.get("platform")
  const entity = searchParams.get("entity")
  const dateFrom = searchParams.get("dateFrom")
  const dateTo = searchParams.get("dateTo")

  const where: Record<string, unknown> = {}
  if (platform) where.platform = platform
  if (entity && entity !== "all") where.entity = entity
  if (dateFrom || dateTo) {
    where.date = {
      ...(dateFrom && { gte: new Date(dateFrom) }),
      ...(dateTo && { lte: new Date(dateTo + "T23:59:59Z") }),
    }
  }

  const metrics = await prisma.socialMetrics.findMany({
    where,
    orderBy: { date: "desc" },
  })

  return NextResponse.json({ metrics })
}

export async function POST(request: Request) {
  const { error: postErr, session } = await requirePageAccess("marketing")
  if (postErr) return postErr

  const body = await request.json()
  const { platform, date, followers, impressions, engagement, clicks, posts, entity } = body

  if (!platform || !date) {
    return NextResponse.json({ error: "platform and date are required" }, { status: 400 })
  }

  const userId = session.user?.id ?? session.user?.email ?? "unknown"
  const ent = entity || "oxen"
  const d = new Date(date)

  // Upsert: update if exists for same platform+date+entity
  const metric = await prisma.socialMetrics.upsert({
    where: { platform_date_entity: { platform, date: d, entity: ent } },
    update: {
      followers: parseInt(followers) || 0,
      impressions: parseInt(impressions) || 0,
      engagement: parseInt(engagement) || 0,
      clicks: parseInt(clicks) || 0,
      posts: parseInt(posts) || 0,
    },
    create: {
      platform,
      date: d,
      followers: parseInt(followers) || 0,
      impressions: parseInt(impressions) || 0,
      engagement: parseInt(engagement) || 0,
      clicks: parseInt(clicks) || 0,
      posts: parseInt(posts) || 0,
      entity: ent,
      createdBy: userId,
    },
  })

  return NextResponse.json({ metric }, { status: 201 })
}
