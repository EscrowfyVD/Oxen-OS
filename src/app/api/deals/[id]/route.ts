import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  const deal = await prisma.deal.findUnique({
    where: { id },
    include: {
      contact: {
        select: { id: true, name: true, company: true, sector: true },
      },
    },
  })

  if (!deal) {
    return NextResponse.json({ error: "Deal not found" }, { status: 404 })
  }

  return NextResponse.json({ deal })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()
  const {
    name, stage, expectedVolume, takeRate, expectedRevenue,
    probability, closeDate, assignedTo, notes,
  } = body

  const existing = await prisma.deal.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: "Deal not found" }, { status: 404 })
  }

  const deal = await prisma.deal.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(stage !== undefined && { stage }),
      ...(expectedVolume !== undefined && {
        expectedVolume: expectedVolume !== null ? parseFloat(expectedVolume) : null,
      }),
      ...(takeRate !== undefined && {
        takeRate: takeRate !== null ? parseFloat(takeRate) : null,
      }),
      ...(expectedRevenue !== undefined && {
        expectedRevenue: expectedRevenue !== null ? parseFloat(expectedRevenue) : null,
      }),
      ...(probability !== undefined && { probability: parseFloat(probability) }),
      ...(closeDate !== undefined && {
        closeDate: closeDate ? new Date(closeDate) : null,
      }),
      ...(assignedTo !== undefined && { assignedTo: assignedTo || null }),
      ...(notes !== undefined && { notes: notes || null }),
    },
    include: {
      contact: {
        select: { id: true, name: true, company: true },
      },
    },
  })

  return NextResponse.json({ deal })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  const existing = await prisma.deal.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: "Deal not found" }, { status: 404 })
  }

  await prisma.deal.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
