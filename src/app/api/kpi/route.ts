import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Get distinct metrics
  const metrics = await prisma.kpiEntry.findMany({
    distinct: ["metric"],
    select: { metric: true },
  })

  const kpis = await Promise.all(
    metrics.map(async ({ metric }) => {
      // Get the two most recent entries for this metric to compute trend
      const entries = await prisma.kpiEntry.findMany({
        where: { metric },
        orderBy: { date: "desc" },
        take: 2,
      })

      const latest = entries[0]
      const previous = entries[1]

      return {
        metric: latest.metric,
        value: latest.value,
        previousValue: previous?.value ?? null,
        date: latest.date,
        entity: latest.entity,
      }
    })
  )

  return NextResponse.json({ kpis })
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { metric, value, date, entity } = body

  if (!metric || value === undefined || !date) {
    return NextResponse.json(
      { error: "Missing required fields: metric, value, date" },
      { status: 400 }
    )
  }

  const userId = session.user?.id ?? session.user?.email ?? "unknown"

  const entry = await prisma.kpiEntry.create({
    data: {
      metric,
      value,
      date: new Date(date),
      entity: entity ?? "oxen",
      createdBy: userId,
    },
  })

  return NextResponse.json({ entry }, { status: 201 })
}
