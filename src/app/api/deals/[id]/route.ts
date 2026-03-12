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

  // Auto-generate insight when deal stage changes
  if (stage !== undefined && stage !== existing.stage) {
    try {
      const stageLabel = stage.replace(/_/g, " ")
      const prevLabel = existing.stage.replace(/_/g, " ")
      const companyName = deal.contact?.company || deal.contact?.name || "unknown"

      let insightType = "buying_signal"
      let severity = "low"
      let title = `Deal "${deal.name}" moved to ${stageLabel}`
      let summary = `Deal "${deal.name}" for ${companyName} moved from ${prevLabel} to ${stageLabel}. Expected revenue: EUR${deal.expectedRevenue?.toLocaleString() || "?"}. Probability: ${deal.probability || "?"}%.`

      if (stage === "closed_won" || stage === "commit" || stage === "volume_ramp") {
        insightType = "opportunity"
        severity = "medium"
        title = `Deal won: "${deal.name}"`
        summary = `Deal "${deal.name}" for ${companyName} has reached ${stageLabel}. Expected revenue: EUR${deal.expectedRevenue?.toLocaleString() || "?"}. Time to celebrate and plan onboarding.`
      } else if (stage === "closed_lost") {
        insightType = "risk"
        severity = "high"
        title = `Deal lost: "${deal.name}"`
        summary = `Deal "${deal.name}" for ${companyName} was marked as lost. Expected revenue was EUR${deal.expectedRevenue?.toLocaleString() || "?"}. Review what happened and document lessons learned.`
      }

      await prisma.aIInsight.create({
        data: {
          type: insightType,
          title,
          summary,
          contactId: deal.contactId,
          severity,
          source: "deal_stage_change",
        },
      })
    } catch (e) {
      console.error("Failed to create deal stage insight:", e)
    }
  }

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
