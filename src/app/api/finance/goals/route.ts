import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"

export async function GET(request: Request) {
  const { error } = await requirePageAccess("finance")
  if (error) return error

  const { searchParams } = new URL(request.url)
  const period = searchParams.get("period")
  const entity = searchParams.get("entity")

  const where: Record<string, unknown> = {}
  if (period) where.period = period
  if (entity && entity !== "all") where.entity = entity

  const goals = await prisma.financeGoal.findMany({
    where,
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json({ goals })
}

export async function POST(request: Request) {
  const { error, session } = await requirePageAccess("finance")
  if (error) return error

  const body = await request.json()
  const { metric, target, entity, period } = body

  if (!metric || target == null || !period) {
    return NextResponse.json({ error: "metric, target, and period are required" }, { status: 400 })
  }

  const userId = session.user?.id ?? session.user?.email ?? "unknown"
  const ent = entity || "oxen"

  // Upsert: delete old goal with same metric+period+entity, then create new
  await prisma.financeGoal.deleteMany({
    where: { metric, period, entity: ent },
  })

  const goal = await prisma.financeGoal.create({
    data: {
      metric,
      target: parseFloat(target),
      entity: ent,
      period,
      createdBy: userId,
    },
  })

  return NextResponse.json({ goal }, { status: 201 })
}
