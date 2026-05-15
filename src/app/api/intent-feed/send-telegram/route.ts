import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"
import { validateBody } from "@/lib/validate"
import { childLoggerFromRequest, serializeError } from "@/lib/logger"
import { notifyEmployee } from "@/lib/telegram"
import { buildHotSignalMessage } from "@/lib/intent-feed/telegram-template"

/**
 * POST /api/intent-feed/send-telegram — broadcast a Telegram alert
 * for a signal to all BDs listed in CRM_BD_EMAILS.
 *
 * No recipient picker in V1: the broadcast list is the canonical BD
 * pool (Andy + Paul + Vernon per the env), matching the convention
 * established by trigify-alerts.ts for the auto-broadcast path. A
 * recipient picker is a V2 enhancement.
 *
 * Custom messages override the default template; both go through
 * the same notifyEmployee() helper that the webhook auto-alert uses,
 * so the Telegram parse-mode contract (HTML) is identical and the
 * retry-without-parse fallback in telegram.ts applies uniformly.
 */
const sendTelegramSchema = z.object({
  signal_id: z.string().min(1).max(100),
  custom_message: z.string().max(4000).optional(),
})

export async function POST(request: Request) {
  const log = childLoggerFromRequest(request).child({ route: "intent-feed/send-telegram" })

  const { error: authErr } = await requirePageAccess("crm")
  if (authErr) return authErr

  const v = await validateBody(request, sendTelegramSchema)
  if ("error" in v) return v.error
  const { signal_id, custom_message } = v.data

  try {
    const signal = await prisma.intentSignal.findUnique({
      where: { id: signal_id },
      include: {
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            jobTitle: true,
            linkedinUrl: true,
            group: true,
            company: { select: { name: true, country: true } },
          },
        },
        company: { select: { name: true, country: true } },
        signalTypeRef: { select: { label: true, code: true } },
      },
    })

    if (!signal) {
      return NextResponse.json({ error: "Signal not found" }, { status: 404 })
    }

    // Resolve company: contact.company takes priority over company-
    // anchored signals, matching the formatSignal precedence in the
    // GET route so the message reflects what the user saw in the card.
    const resolvedCompany = signal.contact?.company ?? signal.company ?? null

    const message =
      custom_message?.trim() ||
      buildHotSignalMessage({
        signalTypeLabel: signal.signalTypeRef.label,
        signalSource: signal.source,
        points: signal.points,
        detail: signal.detail,
        contact: signal.contact
          ? {
              name: `${signal.contact.firstName} ${signal.contact.lastName}`.trim(),
              jobTitle: signal.contact.jobTitle,
              linkedinUrl: signal.contact.linkedinUrl,
              group: signal.contact.group,
            }
          : null,
        company: resolvedCompany,
      })

    const bdEmails = (process.env.CRM_BD_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean)

    if (bdEmails.length === 0) {
      log.warn("CRM_BD_EMAILS empty — no recipients for Telegram broadcast")
      return NextResponse.json(
        { error: "CRM_BD_EMAILS not configured" },
        { status: 500 },
      )
    }

    // Promise.allSettled so one BD without telegramChatId doesn't fail
    // the broadcast for the others. notifyEmployee returns boolean
    // (false on missing chatId), never throws on the happy path.
    const results = await Promise.allSettled(
      bdEmails.map((email) => notifyEmployee(email, message)),
    )

    const succeeded = results.filter(
      (r) => r.status === "fulfilled" && r.value === true,
    ).length
    const failed = bdEmails.length - succeeded

    log.info(
      { signalId: signal_id, recipients: bdEmails.length, succeeded, failed },
      "intent-feed telegram broadcast complete",
    )

    return NextResponse.json({
      ok: true,
      sent_to: bdEmails.length,
      succeeded,
      failed,
    })
  } catch (err) {
    log.error({ err: serializeError(err) }, "intent-feed telegram broadcast failed")
    return NextResponse.json(
      { error: "Failed to send Telegram broadcast" },
      { status: 500 },
    )
  }
}
