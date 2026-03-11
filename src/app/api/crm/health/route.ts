import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // All won customers with health data
  const customers = await prisma.contact.findMany({
    where: { status: "won" },
    select: {
      id: true,
      name: true,
      company: true,
      sector: true,
      segment: true,
      healthStatus: true,
      monthlyGtv: true,
      monthlyRevenue: true,
      takeRate: true,
      projectedVolume: true,
      assignedTo: true,
      metrics: {
        orderBy: { month: "desc" },
        take: 3,
      },
    },
    orderBy: { monthlyGtv: "desc" },
  })

  // Health status distribution
  const healthStatuses = ["healthy", "watch", "at_risk", "declining", "churned"]
  const distribution = healthStatuses.map((status) => ({
    status,
    count: customers.filter((c) => c.healthStatus === status).length,
    totalGtv: customers
      .filter((c) => c.healthStatus === status)
      .reduce((s, c) => s + (c.monthlyGtv ?? 0), 0),
    totalRevenue: customers
      .filter((c) => c.healthStatus === status)
      .reduce((s, c) => s + (c.monthlyRevenue ?? 0), 0),
  }))

  // Segment distribution
  const segments = ["Enterprise", "Mid-Market", "SMB"]
  const bySegment = segments.map((seg) => {
    const segCustomers = customers.filter((c) => c.segment === seg)
    return {
      segment: seg,
      count: segCustomers.length,
      totalGtv: segCustomers.reduce((s, c) => s + (c.monthlyGtv ?? 0), 0),
      avgTakeRate:
        segCustomers.length > 0
          ? segCustomers.reduce((s, c) => s + (c.takeRate ?? 0), 0) / segCustomers.length
          : 0,
    }
  })

  return NextResponse.json({
    health: {
      customers,
      distribution,
      bySegment,
      totalCustomers: customers.length,
    },
  })
}
