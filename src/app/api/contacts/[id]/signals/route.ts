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

  const signals = await prisma.intentSignal.findMany({
    where: { contactId: id },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json({ signals })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await request.json()

  const signal = await prisma.intentSignal.create({
    data: {
      contactId: id,
      source: body.source || "manual",
      signalType: body.signalType || "web_visit",
      title: body.title || "Signal",
      detail: body.detail || null,
      score: body.score ?? 10,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      raw: body.raw || null,
    },
  })

  // Recalculate intentScore: sum of non-expired signal scores, capped at 100
  const now = new Date()
  const allSignals = await prisma.intentSignal.findMany({
    where: { contactId: id },
    select: { score: true, expiresAt: true },
  })
  const totalScore = allSignals
    .filter((s) => !s.expiresAt || s.expiresAt > now)
    .reduce((sum, s) => sum + s.score, 0)

  await prisma.contact.update({
    where: { id },
    data: { intentScore: Math.min(totalScore, 100) },
  })

  return NextResponse.json({ signal }, { status: 201 })
}
