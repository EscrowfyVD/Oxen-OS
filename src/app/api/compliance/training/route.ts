import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity"

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const category = searchParams.get("category")
    const status = searchParams.get("status")
    const entityId = searchParams.get("entityId")

    const where: Record<string, unknown> = {}
    if (category && category !== "all") where.category = category
    if (status && status !== "all") where.status = status
    if (entityId && entityId !== "all") where.entityId = entityId

    const trainings = await prisma.training.findMany({
      where,
      include: {
        entity: { select: { id: true, name: true } },
        _count: { select: { completions: true } },
        completions: {
          select: { status: true },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    // Add completion stats to each training
    const result = trainings.map((t) => {
      const total = t.completions.length
      const completed = t.completions.filter((c) => c.status === "completed").length
      const { completions: _completions, ...rest } = t
      return {
        ...rest,
        completionStats: { total, completed, rate: total > 0 ? Math.round((completed / total) * 100) : 0 },
      }
    })

    return NextResponse.json({ trainings: result })
  } catch (error) {
    console.error("[Compliance Training GET] Error:", error)
    return NextResponse.json({ error: "Failed to fetch trainings" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const { title, category, description, provider, durationHours, frequency, mandatory, entityId, dueDate, status } = body

    if (!title || !category) {
      return NextResponse.json({ error: "title and category are required" }, { status: 400 })
    }

    const userId = session.user?.id ?? session.user?.email ?? "unknown"

    // Auto-generate code TRN-001
    const lastTraining = await prisma.training.findFirst({
      where: { code: { startsWith: "TRN-" } },
      orderBy: { code: "desc" },
    })
    let nextNum = 1
    if (lastTraining) {
      const match = lastTraining.code.match(/TRN-(\d+)/)
      if (match) nextNum = parseInt(match[1]) + 1
    }
    const code = `TRN-${String(nextNum).padStart(3, "0")}`

    const training = await prisma.training.create({
      data: {
        title,
        code,
        category,
        description: description || null,
        provider: provider || null,
        durationHours: durationHours ?? null,
        frequency: frequency || null,
        mandatory: mandatory ?? true,
        entityId: entityId || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        status: status || "active",
        createdBy: userId,
      },
      include: {
        entity: { select: { id: true, name: true } },
      },
    })

    logActivity("training_created", `Created training ${code}: ${title}`, userId, entityId || undefined, `/compliance/training`)

    return NextResponse.json({ training }, { status: 201 })
  } catch (error) {
    console.error("[Compliance Training POST] Error:", error)
    return NextResponse.json({ error: "Failed to create training" }, { status: 500 })
  }
}
