import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get("status")
  const platform = searchParams.get("platform")
  const search = searchParams.get("search")

  const where: Record<string, unknown> = {}
  if (status && status !== "all") where.status = status
  if (platform && platform !== "all") where.platform = platform
  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ]
  }

  const ideas = await prisma.contentIdea.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }],
  })

  return NextResponse.json({ ideas })
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const { title, description, platform, type, status, priority, scheduledFor, assignedTo, tags, notes } = body

  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 })
  }

  const userId = session.user?.id ?? session.user?.email ?? "unknown"

  const idea = await prisma.contentIdea.create({
    data: {
      title,
      description: description || null,
      platform: platform || null,
      type: type || null,
      status: status || "idea",
      priority: priority || "medium",
      scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
      assignedTo: assignedTo || null,
      tags: tags || [],
      notes: notes || null,
      createdBy: userId,
    },
  })

  return NextResponse.json({ idea }, { status: 201 })
}
