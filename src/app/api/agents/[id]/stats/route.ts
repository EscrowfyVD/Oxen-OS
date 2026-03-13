import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  const agent = await prisma.agent.findUnique({
    where: { id },
    include: {
      referredClients: {
        select: {
          id: true, monthlyRevenue: true, monthlyGtv: true, status: true,
          deals: { select: { stage: true, expectedRevenue: true } },
          metrics: { orderBy: { month: "desc" }, take: 12 },
        },
      },
    },
  })

  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 })

  const totalClients = agent.referredClients.length
  const totalRevenue = agent.referredClients.reduce((sum, c) => sum + (c.monthlyRevenue ?? 0), 0)
  const totalGtv = agent.referredClients.reduce((sum, c) => sum + (c.monthlyGtv ?? 0), 0)
  const avgCommission = agent.commissionDirect
  const activeDeals = agent.referredClients.reduce(
    (sum, c) => sum + (c.deals?.filter((d) => !["closed_won", "closed_lost"].includes(d.stage)).length ?? 0),
    0
  )

  // Build monthly revenue trend from metrics
  const monthlyMap = new Map<string, number>()
  for (const client of agent.referredClients) {
    for (const m of client.metrics ?? []) {
      monthlyMap.set(m.month, (monthlyMap.get(m.month) ?? 0) + m.revenue)
    }
  }
  const monthlyTrend = Array.from(monthlyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, revenue]) => ({ month, revenue }))

  return NextResponse.json({
    stats: { totalClients, totalRevenue, totalGtv, avgCommission, activeDeals, monthlyTrend },
  })
}
