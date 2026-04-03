import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"
import { PLAYBOOK_TEMPLATES } from "@/lib/playbook-templates"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ dealId: string }> }
) {
  const { error: pageErr, session } = await requirePageAccess("crm")
  if (pageErr) return pageErr

  const { dealId } = await params
  const body = await request.json().catch(() => ({}))

  let stage: string | undefined = body.stage

  // If no stage provided, fetch the deal's current stage
  if (!stage) {
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      select: { stage: true },
    })
    if (!deal) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 })
    }
    stage = deal.stage
  }

  // Check if steps already exist for this stage + deal
  const existing = await prisma.playbookStep.findFirst({
    where: { dealId, stage },
  })

  if (existing) {
    // Already initialized — return existing steps
    const steps = await prisma.playbookStep.findMany({
      where: { dealId, stage },
      orderBy: { order: "asc" },
    })
    return NextResponse.json({ steps, alreadyExisted: true })
  }

  // Create from templates
  const template = PLAYBOOK_TEMPLATES[stage]
  if (!template || template.length === 0) {
    return NextResponse.json({ steps: [], message: "No template for this stage" })
  }

  const created = await prisma.$transaction(
    template.map((t, idx) =>
      prisma.playbookStep.create({
        data: {
          dealId,
          stage,
          title: t.title,
          description: t.description ?? null,
          isBlocking: t.isBlocking ?? false,
          order: idx,
        },
      })
    )
  )

  return NextResponse.json({ steps: created })
}
