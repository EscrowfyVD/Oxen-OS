import { NextResponse } from "next/server"
import { z } from "zod"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"
import { validateBody } from "@/lib/validate"
import { childLoggerFromRequest, serializeError } from "@/lib/logger"

/**
 * POST /api/intent-feed/[id]/action — record an action on a signal.
 *
 * V1 supports a single action: `mark_actioned`. The action stamps
 * `metadata.actioned_at` (ISO) + `metadata.actioned_by` (session email)
 * via a read-modify-write of the JSON column. Prisma's Json field
 * type doesn't support partial JSON updates natively, but write
 * contention on a per-signal basis is negligible — Andy and Paul
 * are not racing to action the same lead.
 *
 * Future actions to add (V2): `mark_dismissed`, `snoozed_until`,
 * etc. — same endpoint, switched on `body.type`.
 */
const actionSchema = z.object({
  type: z.literal("mark_actioned"),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const log = childLoggerFromRequest(request).child({ route: "intent-feed/action" })

  const { error: authErr, session } = await requirePageAccess("crm")
  if (authErr) return authErr

  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: "Missing signal id" }, { status: 400 })
  }

  const v = await validateBody(request, actionSchema)
  if ("error" in v) return v.error
  const { type } = v.data

  try {
    const existing = await prisma.intentSignal.findUnique({
      where: { id },
      select: { id: true, metadata: true },
    })
    if (!existing) {
      return NextResponse.json({ error: "Signal not found" }, { status: 404 })
    }

    const userEmail = session?.user?.email ?? "unknown"
    const actionedAt = new Date().toISOString()

    // Read-modify-write the metadata JSON. Coerce null/non-object to
    // an empty object so the spread doesn't crash on a legacy signal
    // with metadata=null or metadata=<string>.
    const baseMeta =
      existing.metadata && typeof existing.metadata === "object" && !Array.isArray(existing.metadata)
        ? (existing.metadata as Record<string, unknown>)
        : {}

    const newMeta: Prisma.InputJsonValue = {
      ...baseMeta,
      actioned_at: actionedAt,
      actioned_by: userEmail,
    }

    await prisma.intentSignal.update({
      where: { id },
      data: { metadata: newMeta },
    })

    log.info(
      { signalId: id, actionedBy: userEmail, type },
      "intent signal marked as actioned",
    )

    return NextResponse.json({
      ok: true,
      action_type: type,
      signal_id: id,
      actioned_at: actionedAt,
      actioned_by: userEmail,
    })
  } catch (err) {
    log.error({ err: serializeError(err) }, "intent-feed action failed")
    return NextResponse.json(
      { error: "Failed to record action" },
      { status: 500 },
    )
  }
}
