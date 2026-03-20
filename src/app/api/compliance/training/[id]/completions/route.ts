import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params

    const training = await prisma.training.findUnique({ where: { id } })
    if (!training) return NextResponse.json({ error: "Training not found" }, { status: 404 })

    const completions = await prisma.trainingCompletion.findMany({
      where: { trainingId: id },
      include: {
        employee: {
          select: { id: true, name: true, email: true, department: true, entityId: true },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ completions })
  } catch (error) {
    console.error("[Training Completions GET] Error:", error)
    return NextResponse.json({ error: "Failed to fetch completions" }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const body = await request.json()
    const { employeeId, completedAt, expiresAt, score, certificateUrl, status, notes } = body

    if (!employeeId) {
      return NextResponse.json({ error: "employeeId is required" }, { status: 400 })
    }

    const training = await prisma.training.findUnique({ where: { id } })
    if (!training) return NextResponse.json({ error: "Training not found" }, { status: 404 })

    // Upsert — create or update completion for this employee
    const completion = await prisma.trainingCompletion.upsert({
      where: {
        trainingId_employeeId: { trainingId: id, employeeId },
      },
      create: {
        trainingId: id,
        employeeId,
        completedAt: completedAt ? new Date(completedAt) : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        score: score ?? null,
        certificateUrl: certificateUrl || null,
        status: status || "pending",
        notes: notes || null,
      },
      update: {
        ...(completedAt !== undefined && { completedAt: completedAt ? new Date(completedAt) : null }),
        ...(expiresAt !== undefined && { expiresAt: expiresAt ? new Date(expiresAt) : null }),
        ...(score !== undefined && { score }),
        ...(certificateUrl !== undefined && { certificateUrl: certificateUrl || null }),
        ...(status !== undefined && { status }),
        ...(notes !== undefined && { notes: notes || null }),
      },
      include: {
        employee: {
          select: { id: true, name: true, email: true, department: true },
        },
      },
    })

    return NextResponse.json({ completion }, { status: 201 })
  } catch (error) {
    console.error("[Training Completions POST] Error:", error)
    return NextResponse.json({ error: "Failed to create/update completion" }, { status: 500 })
  }
}
