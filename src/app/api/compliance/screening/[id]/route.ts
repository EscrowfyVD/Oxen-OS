import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const body = await request.json()
    const { result, matchDetails, riskLevel, notes, reviewedBy, nextScreeningDate } = body

    const existing = await prisma.screeningRecord.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: "Screening record not found" }, { status: 404 })

    const userId = session.user?.id ?? session.user?.email ?? "unknown"

    // If review is being added, set reviewedBy and reviewedAt
    const reviewData: Record<string, unknown> = {}
    if (reviewedBy !== undefined || result !== undefined) {
      reviewData.reviewedBy = reviewedBy || userId
      reviewData.reviewedAt = new Date()
    }

    const screening = await prisma.screeningRecord.update({
      where: { id },
      data: {
        ...(result !== undefined && { result }),
        ...(matchDetails !== undefined && { matchDetails }),
        ...(riskLevel !== undefined && { riskLevel: riskLevel || null }),
        ...(notes !== undefined && { notes: notes || null }),
        ...(nextScreeningDate !== undefined && { nextScreeningDate: nextScreeningDate ? new Date(nextScreeningDate) : null }),
        ...reviewData,
      },
    })

    logActivity("screening_updated", `Updated screening for ${existing.subjectName}: result=${screening.result}`, userId, undefined, `/compliance/screening`)

    return NextResponse.json({ screening })
  } catch (error) {
    console.error("[Compliance Screening PATCH] Error:", error)
    return NextResponse.json({ error: "Failed to update screening" }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params

    const existing = await prisma.screeningRecord.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: "Screening record not found" }, { status: 404 })

    await prisma.screeningRecord.delete({ where: { id } })

    const userId = session.user?.id ?? session.user?.email ?? "unknown"
    logActivity("screening_deleted", `Deleted screening for ${existing.subjectName}`, userId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Compliance Screening DELETE] Error:", error)
    return NextResponse.json({ error: "Failed to delete screening" }, { status: 500 })
  }
}
