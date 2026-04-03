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
        select: { id: true, firstName: true, lastName: true, company: { select: { id: true, name: true } }, vertical: true },
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
    dealName, stage, dealValue,
    winProbability, closeDate, dealOwner, notes,
  } = body

  const existing = await prisma.deal.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: "Deal not found" }, { status: 404 })
  }

  const deal = await prisma.deal.update({
    where: { id },
    data: {
      ...(dealName !== undefined && { dealName }),
      ...(stage !== undefined && { stage }),
      ...(dealValue !== undefined && {
        dealValue: dealValue !== null ? parseFloat(dealValue) : null,
      }),
      ...(winProbability !== undefined && { winProbability: parseFloat(winProbability) }),
      ...(closeDate !== undefined && {
        closeDate: closeDate ? new Date(closeDate) : null,
      }),
      ...(dealOwner !== undefined && { dealOwner: dealOwner || null }),
      ...(notes !== undefined && { notes: notes || null }),
    },
    include: {
      contact: {
        select: { id: true, firstName: true, lastName: true, company: { select: { id: true, name: true } } },
      },
    },
  })

  // Auto-generate insight when deal stage changes
  if (stage !== undefined && stage !== existing.stage) {
    try {
      const stageLabel = stage.replace(/_/g, " ")
      const prevLabel = existing.stage.replace(/_/g, " ")
      const companyName = deal.contact?.company?.name || (deal.contact ? `${deal.contact.firstName} ${deal.contact.lastName}` : "unknown")

      let insightType = "buying_signal"
      let severity = "low"
      let title = `Deal "${deal.dealName}" moved to ${stageLabel}`
      let summary = `Deal "${deal.dealName}" for ${companyName} moved from ${prevLabel} to ${stageLabel}. Expected revenue: EUR${deal.dealValue?.toLocaleString() || "?"}. Probability: ${deal.winProbability || "?"}%.`

      if (stage === "closed_won" || stage === "commit" || stage === "volume_ramp") {
        insightType = "opportunity"
        severity = "medium"
        title = `Deal won: "${deal.dealName}"`
        summary = `Deal "${deal.dealName}" for ${companyName} has reached ${stageLabel}. Expected revenue: EUR${deal.dealValue?.toLocaleString() || "?"}. Time to celebrate and plan onboarding.`
      } else if (stage === "closed_lost") {
        insightType = "risk"
        severity = "high"
        title = `Deal lost: "${deal.dealName}"`
        summary = `Deal "${deal.dealName}" for ${companyName} was marked as lost. Expected revenue was EUR${deal.dealValue?.toLocaleString() || "?"}. Review what happened and document lessons learned.`
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
