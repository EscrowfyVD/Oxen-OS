import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()
  const { month, gtv, revenue, takeRate, txCount } = body

  if (!month) {
    return NextResponse.json(
      { error: "Missing required field: month" },
      { status: 400 }
    )
  }

  // Verify contact exists
  const contact = await prisma.contact.findUnique({ where: { id } })
  if (!contact) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 })
  }

  // Upsert: create or update for this contact + month
  const metric = await prisma.customerMetrics.upsert({
    where: {
      contactId_month: { contactId: id, month },
    },
    create: {
      contactId: id,
      month,
      gtv: gtv ? parseFloat(gtv) : 0,
      revenue: revenue ? parseFloat(revenue) : 0,
      takeRate: takeRate ? parseFloat(takeRate) : 0,
      txCount: txCount ? parseInt(txCount) : 0,
    },
    update: {
      ...(gtv !== undefined && { gtv: parseFloat(gtv) }),
      ...(revenue !== undefined && { revenue: parseFloat(revenue) }),
      ...(takeRate !== undefined && { takeRate: parseFloat(takeRate) }),
      ...(txCount !== undefined && { txCount: parseInt(txCount) }),
    },
  })

  return NextResponse.json({ metric }, { status: 201 })
}
