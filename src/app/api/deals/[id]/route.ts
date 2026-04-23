import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { serializeMoney, toDecimal } from "@/lib/decimal"

// Sprint 3.2 — Pattern C: non-throwing wrapper for monetary user inputs.
// Preserves exact decimal precision (avoids float drift on fractional values)
// while keeping the previous graceful-failure semantics of parseFloat || 0.
function safeMoney(v: unknown): Prisma.Decimal | null {
  if (v === null || v === undefined || v === "") return null
  try {
    return toDecimal(v as string | number)
  } catch {
    return null
  }
}

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

  // Sprint 3.2 — serialize Decimal fields for JSON.
  return NextResponse.json({
    deal: {
      ...deal,
      dealValue: serializeMoney(deal.dealValue),
      weightedValue: serializeMoney(deal.weightedValue),
    },
  })
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
        // Sprint 3.2 — Pattern C: toDecimal preserves exact user-entered precision.
        dealValue: safeMoney(dealValue),
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
      // Sprint 3.2 — convert Decimal to number for .toLocaleString() (which on
      // Decimal returns bare digits with no thousand separators).
      const dvNum = serializeMoney(deal.dealValue)
      const dvFmt = dvNum != null ? dvNum.toLocaleString() : "?"
      let title = `Deal "${deal.dealName}" moved to ${stageLabel}`
      let summary = `Deal "${deal.dealName}" for ${companyName} moved from ${prevLabel} to ${stageLabel}. Expected revenue: EUR${dvFmt}. Probability: ${deal.winProbability || "?"}%.`

      if (stage === "closed_won" || stage === "commit" || stage === "volume_ramp") {
        insightType = "opportunity"
        severity = "medium"
        title = `Deal won: "${deal.dealName}"`
        summary = `Deal "${deal.dealName}" for ${companyName} has reached ${stageLabel}. Expected revenue: EUR${dvFmt}. Time to celebrate and plan onboarding.`
      } else if (stage === "closed_lost") {
        insightType = "risk"
        severity = "high"
        title = `Deal lost: "${deal.dealName}"`
        summary = `Deal "${deal.dealName}" for ${companyName} was marked as lost. Expected revenue was EUR${dvFmt}. Review what happened and document lessons learned.`
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

  // Sprint 3.2 — serialize Decimal fields for JSON.
  return NextResponse.json({
    deal: {
      ...deal,
      dealValue: serializeMoney(deal.dealValue),
      weightedValue: serializeMoney(deal.weightedValue),
    },
  })
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
