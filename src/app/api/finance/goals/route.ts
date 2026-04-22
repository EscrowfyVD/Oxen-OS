import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"
import { validateBody, validateSearchParams } from "@/lib/validate"
import { createFinanceGoalSchema, listGoalsQuery } from "../_schemas"

export async function GET(request: Request) {
  const { error } = await requirePageAccess("finance")
  if (error) return error

  const { searchParams } = new URL(request.url)
  const vq = validateSearchParams(searchParams, listGoalsQuery)
  if ("error" in vq) return vq.error
  const { period, entity } = vq.data

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

  const v = await validateBody(request, createFinanceGoalSchema)
  if ("error" in v) return v.error
  const { metric, target, entity, period } = v.data

  const userId = session.user?.id ?? session.user?.email ?? "unknown"
  const ent = entity || "oxen"

  // Upsert: delete old goal with same metric+period+entity, then create new
  await prisma.financeGoal.deleteMany({
    where: { metric, period, entity: ent },
  })

  const goal = await prisma.financeGoal.create({
    data: {
      metric,
      target,
      entity: ent,
      period,
      createdBy: userId,
    },
  })

  return NextResponse.json({ goal }, { status: 201 })
}
