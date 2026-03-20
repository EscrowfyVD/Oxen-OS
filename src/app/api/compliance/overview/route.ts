import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // Policy counts by status
    const policies = await prisma.policy.groupBy({
      by: ["status"],
      _count: { id: true },
    })
    const policyCounts: Record<string, number> = {}
    for (const p of policies) {
      policyCounts[p.status] = p._count.id
    }

    // Risk counts by status + average risk score
    const risks = await prisma.risk.groupBy({
      by: ["status"],
      _count: { id: true },
      _avg: { riskScore: true },
    })
    const riskCounts: Record<string, number> = {}
    let totalRiskScore = 0
    let totalRiskCount = 0
    for (const r of risks) {
      riskCounts[r.status] = r._count.id
      totalRiskScore += (r._avg.riskScore ?? 0) * r._count.id
      totalRiskCount += r._count.id
    }
    const averageRiskScore = totalRiskCount > 0 ? Math.round((totalRiskScore / totalRiskCount) * 10) / 10 : 0

    // Training completion rate
    const trainingTotal = await prisma.trainingCompletion.count()
    const trainingCompleted = await prisma.trainingCompletion.count({
      where: { status: "completed" },
    })
    const trainingCompletionRate = trainingTotal > 0 ? Math.round((trainingCompleted / trainingTotal) * 100) : 0

    // Incident counts by status
    const incidents = await prisma.complianceIncident.groupBy({
      by: ["status"],
      _count: { id: true },
    })
    const incidentCounts: Record<string, number> = {}
    for (const i of incidents) {
      incidentCounts[i.status] = i._count.id
    }

    // License counts by status
    const licenses = await prisma.regulatoryLicense.groupBy({
      by: ["status"],
      _count: { id: true },
    })
    const licenseCounts: Record<string, number> = {}
    for (const l of licenses) {
      licenseCounts[l.status] = l._count.id
    }

    // Screening counts by result
    const screenings = await prisma.screeningRecord.groupBy({
      by: ["result"],
      _count: { id: true },
    })
    const screeningCounts: Record<string, number> = {}
    for (const s of screenings) {
      screeningCounts[s.result] = s._count.id
    }

    // Upcoming deadlines
    const now = new Date()
    const thirtyDaysFromNow = new Date()
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)

    const policiesForReview = await prisma.policy.findMany({
      where: {
        reviewDate: { gte: now, lte: thirtyDaysFromNow },
        status: { in: ["active", "approved"] },
      },
      select: { id: true, title: true, code: true, reviewDate: true },
      orderBy: { reviewDate: "asc" },
    })

    const trainingsDue = await prisma.training.findMany({
      where: {
        dueDate: { gte: now, lte: thirtyDaysFromNow },
        status: "active",
      },
      select: { id: true, title: true, code: true, dueDate: true },
      orderBy: { dueDate: "asc" },
    })

    const licenseRenewals = await prisma.regulatoryLicense.findMany({
      where: {
        OR: [
          { renewalDate: { gte: now, lte: thirtyDaysFromNow } },
          { expiryDate: { gte: now, lte: thirtyDaysFromNow } },
        ],
      },
      select: { id: true, name: true, regulator: true, renewalDate: true, expiryDate: true },
      orderBy: { renewalDate: "asc" },
    })

    // Flatten upcoming deadlines into a single sorted array
    const upcomingDeadlines = [
      ...policiesForReview.map((p) => ({ type: "policy_review", title: `${p.code}: ${p.title}`, date: p.reviewDate!.toISOString(), id: p.id })),
      ...trainingsDue.map((t) => ({ type: "training_due", title: `${t.code}: ${t.title}`, date: t.dueDate!.toISOString(), id: t.id })),
      ...licenseRenewals.map((l) => ({ type: "license_renewal", title: `${l.name} (${l.regulator})`, date: (l.renewalDate || l.expiryDate)!.toISOString(), id: l.id })),
    ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    return NextResponse.json({
      policies: policyCounts,
      risks: riskCounts,
      avgRiskScore: averageRiskScore,
      trainingCompletionRate,
      trainingTotal,
      trainingCompleted,
      incidents: incidentCounts,
      licenses: licenseCounts,
      screening: screeningCounts,
      upcomingDeadlines,
    })
  } catch (error) {
    console.error("[Compliance Overview] Error:", error)
    return NextResponse.json({ error: "Failed to fetch compliance overview" }, { status: 500 })
  }
}
