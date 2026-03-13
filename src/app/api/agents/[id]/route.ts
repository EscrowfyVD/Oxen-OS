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
          id: true, name: true, company: true,
          monthlyRevenue: true, monthlyGtv: true,
          status: true, healthStatus: true, sector: true,
        },
        orderBy: { monthlyRevenue: "desc" },
      },
      _count: { select: { referredClients: true } },
    },
  })

  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 })

  return NextResponse.json({ agent })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await request.json()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {}
  const fields = [
    "name", "company", "type", "email", "phone", "telegram", "whatsapp",
    "country", "website", "status", "notes",
  ]
  for (const f of fields) {
    if (body[f] !== undefined) data[f] = body[f] || null
  }
  if (body.commissionDirect !== undefined) data.commissionDirect = parseFloat(body.commissionDirect)
  if (body.commissionIndirect !== undefined) data.commissionIndirect = parseFloat(body.commissionIndirect)
  if (body.onboardedAt !== undefined) data.onboardedAt = body.onboardedAt ? new Date(body.onboardedAt) : null
  if (body.name) data.name = body.name // name should not be null

  const agent = await prisma.agent.update({ where: { id }, data })

  return NextResponse.json({ agent })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  // Unlink all referred clients first
  await prisma.contact.updateMany({
    where: { agentId: id },
    data: { agentId: null, clientType: "direct" },
  })

  await prisma.agent.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
