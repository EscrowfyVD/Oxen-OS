import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"
import { logActivity } from "@/lib/activity"

export async function GET(request: Request) {
  const { error } = await requirePageAccess("crm")
  if (error) return error

  const { searchParams } = new URL(request.url)
  const status = searchParams.get("status")
  const limit = searchParams.get("limit")

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {}
  if (status && status !== "all") where.status = status

  const agents = await prisma.agent.findMany({
    where,
    include: {
      _count: { select: { referredClients: true } },
      referredClients: {
        select: { id: true, monthlyRevenue: true, status: true },
      },
    },
    orderBy: { createdAt: "desc" },
    ...(limit ? { take: parseInt(limit, 10) } : {}),
  })

  // Compute totalRevenue for each agent from referred clients
  const agentsWithRevenue = agents.map((a) => {
    const totalRevenue = a.referredClients.reduce((sum, c) => sum + (c.monthlyRevenue ?? 0), 0)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { referredClients, ...rest } = a
    return { ...rest, totalRevenue }
  })

  return NextResponse.json({ agents: agentsWithRevenue })
}

export async function POST(request: Request) {
  const { error: pageErr, session } = await requirePageAccess("crm")
  if (pageErr) return pageErr

  const body = await request.json()
  const { name, type, ...rest } = body

  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 })

  const agent = await prisma.agent.create({
    data: {
      name,
      type: type || "broker",
      company: rest.company || null,
      email: rest.email || null,
      phone: rest.phone || null,
      telegram: rest.telegram || null,
      whatsapp: rest.whatsapp || null,
      country: rest.country || null,
      website: rest.website || null,
      commissionDirect: rest.commissionDirect ? parseFloat(rest.commissionDirect) : 15,
      commissionIndirect: rest.commissionIndirect ? parseFloat(rest.commissionIndirect) : 5,
      status: rest.status || "prospect",
      onboardedAt: rest.onboardedAt ? new Date(rest.onboardedAt) : null,
      notes: rest.notes || null,
      createdBy: session.user?.email ?? "unknown",
    },
  })

  const userId = session.user?.email ?? "unknown"
  logActivity("agent_created", `New agent registered — ${name}`, userId, agent.id, `/crm`)

  return NextResponse.json({ agent }, { status: 201 })
}
