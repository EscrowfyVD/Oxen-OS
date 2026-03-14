import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/admin"

export async function GET() {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let rules = await prisma.leaveRules.findFirst()

  // Create default if none exists
  if (!rules) {
    rules = await prisma.leaveRules.create({
      data: {
        generalPolicy: "All leave requests must be submitted in advance through the Absences module. Requests are subject to manager approval.",
        vacationQuota: 25,
        vacationMinNotice: 14,
        vacationMaxConsecutive: 15,
        vacationCarryOver: 5,
        sickQuota: 10,
        sickCertAfterDays: 3,
        oooQuota: 15,
        oooMinNotice: 3,
        oooReasonRequired: true,
        approvalTimeline: 2,
        blackoutPeriods: [],
      },
    })
  }

  return NextResponse.json({ rules })
}

export async function PATCH(request: Request) {
  const { error, employee } = await requireRole("admin")
  if (error) return error

  const body = await request.json()

  let rules = await prisma.leaveRules.findFirst()
  if (!rules) {
    rules = await prisma.leaveRules.create({ data: {} })
  }

  const updateData: Record<string, unknown> = {}
  const allowedFields = [
    "generalPolicy", "vacationQuota", "vacationMinNotice", "vacationMaxConsecutive",
    "vacationCarryOver", "sickQuota", "sickCertAfterDays", "oooQuota", "oooMinNotice",
    "oooReasonRequired", "approvalTimeline", "blackoutPeriods",
  ]

  for (const key of allowedFields) {
    if (key in body) {
      updateData[key] = body[key]
    }
  }

  updateData.updatedBy = employee?.name ?? "Unknown"

  const updated = await prisma.leaveRules.update({
    where: { id: rules.id },
    data: updateData,
  })

  return NextResponse.json({ rules: updated })
}
