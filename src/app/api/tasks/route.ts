import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity"

export async function GET(request: Request) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const tag = searchParams.get("tag")

  const where: Record<string, unknown> = {}

  if (tag && tag !== "all") {
    where.tag = tag
  }

  const tasks = await prisma.task.findMany({
    where,
    orderBy: [{ column: "asc" }, { order: "asc" }],
  })

  return NextResponse.json({ tasks })
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { title, description, tag, priority, assignee, deadline, column } = body

  if (!title || !tag) {
    return NextResponse.json(
      { error: "Missing required fields: title, tag" },
      { status: 400 }
    )
  }

  const userId = session.user?.email ?? "unknown"

  const task = await prisma.task.create({
    data: {
      title,
      description: description ?? null,
      tag,
      priority: priority ?? "medium",
      assignee: assignee ?? null,
      deadline: deadline ? new Date(deadline) : null,
      column: column ?? "todo",
      createdBy: userId,
    },
  })

  logActivity("task_created", `Task created — ${title}`, userId, task.id, `/tasks`)

  return NextResponse.json({ task }, { status: 201 })
}
