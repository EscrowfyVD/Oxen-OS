import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity"
import { validateBody, validateSearchParams } from "@/lib/validate"
import { createScreeningSchema, listScreeningsQuery } from "../_schemas"

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const vq = validateSearchParams(searchParams, listScreeningsQuery)
    if ("error" in vq) return vq.error
    const { result, screeningType, subjectType } = vq.data

    const where: Record<string, unknown> = {}
    if (result && result !== "all") where.result = result
    if (screeningType && screeningType !== "all") where.screeningType = screeningType
    if (subjectType && subjectType !== "all") where.subjectType = subjectType

    const screenings = await prisma.screeningRecord.findMany({
      where,
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ screenings })
  } catch (error) {
    console.error("[Compliance Screening GET] Error:", error)
    return NextResponse.json({ error: "Failed to fetch screenings" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const v = await validateBody(request, createScreeningSchema)
    if ("error" in v) return v.error
    const { subjectName, subjectType, screeningType, result, provider, matchDetails, contactId, riskLevel, notes, nextScreeningDate } = v.data

    const userId = session.user?.id ?? session.user?.email ?? "unknown"

    const screening = await prisma.screeningRecord.create({
      data: {
        subjectName,
        subjectType,
        screeningType,
        result: result || "clear",
        provider: provider || null,
        matchDetails: (matchDetails as object) || undefined,
        contactId: contactId || null,
        riskLevel: riskLevel || null,
        notes: notes || null,
        screenedBy: userId,
        nextScreeningDate: nextScreeningDate ? new Date(nextScreeningDate) : null,
      },
    })

    logActivity("screening_created", `Screening completed for ${subjectName} (${screeningType}): ${result || "clear"}`, userId, undefined, `/compliance/screening`)

    return NextResponse.json({ screening }, { status: 201 })
  } catch (error) {
    console.error("[Compliance Screening POST] Error:", error)
    return NextResponse.json({ error: "Failed to create screening" }, { status: 500 })
  }
}
