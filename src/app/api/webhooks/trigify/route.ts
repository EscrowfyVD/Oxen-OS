import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireWebhookSecret } from "@/lib/webhook-auth"
import { validateBody } from "@/lib/validate"
import { childLoggerFromRequest, serializeError } from "@/lib/logger"
import { deriveSignalStamp } from "@/lib/scoring/derive-signal-stamp"
import { trigifyWebhookSchema } from "../_schemas"
import { matchContact } from "@/lib/trigify-matching"
import {
  mapSignalTypeToCode,
  DEFAULT_SIGNAL_CODE,
} from "@/lib/trigify-signal-mapping"
import { findExistingSignal } from "@/lib/trigify-dedup"
import { maybeAlertBDs } from "@/lib/trigify-alerts"
import { applyReactiveLayer } from "@/lib/scoring/apply-reactive-layer"

const MS_PER_DAY = 1000 * 60 * 60 * 24

export async function POST(request: Request) {
  const authFail = requireWebhookSecret(request, {
    envVarName: "TRIGIFY_WEBHOOK_SECRET",
  })
  if (authFail) return authFail

  const v = await validateBody(request, trigifyWebhookSchema, {
    publicErrors: false,
  })
  if ("error" in v) return v.error
  const payload = v.data

  const log = childLoggerFromRequest(request).child({ webhook: "trigify" })

  try {
    // ── Step 1: resolve contact (LinkedIn URL → email → name+company → auto-create) ──
    const match = await matchContact(payload)
    if (!match.contact) {
      log.warn(
        { signal_type: payload.signal_type },
        "[trigify] no usable identifier in payload, skipping",
      )
      return NextResponse.json({ ok: true, action: "no_match" })
    }

    log.info(
      {
        match_method: match.matchMethod,
        contact_id: match.contact.id,
        signal_type: payload.signal_type,
        person_linkedin_url: payload.person_linkedin_url,
      },
      `[trigify] matched contact via ${match.matchMethod}`,
    )

    // ── Step 2: resolve canonical SignalTypeRegistry code ──
    const signalCode = mapSignalTypeToCode(payload.signal_type)
    if (signalCode === DEFAULT_SIGNAL_CODE && payload.signal_type) {
      log.warn(
        { signal_type: payload.signal_type },
        "[trigify] unknown signal_type, falling back to deprecated placeholder",
      )
    }

    const registryEntry = await prisma.signalTypeRegistry.findUnique({
      where: { code: signalCode },
    })

    if (!registryEntry || !registryEntry.isActive) {
      // Either the registry hasn't been seeded yet, or the resolved code
      // is the deprecated placeholder (isActive=false). Both mean we
      // cannot safely persist this signal — log + 200 so Trigify does
      // not retry. Operator surfaces these via log warnings.
      log.warn(
        {
          signal_code: signalCode,
          contact_id: match.contact.id,
          registry_active: registryEntry?.isActive ?? false,
        },
        "[trigify] signal type unavailable, dropping signal",
      )
      return NextResponse.json({
        ok: true,
        action: "registry_unavailable",
        contact_id: match.contact.id,
      })
    }

    // ── Step 3: derive lifecycle anchors from registry + payload ──
    const signalDate = payload.signal_date
      ? new Date(payload.signal_date)
      : new Date()
    const occurredAt = isNaN(signalDate.getTime()) ? new Date() : signalDate
    const expiresAt = new Date(
      occurredAt.getTime() + registryEntry.decayDays * MS_PER_DAY,
    )
    // Stamp (intentCategory/signalLevel/points) via the shared
    // deriveSignalStamp helper. Trigify's two-level custom-points fallback is
    // preserved EXACTLY: pass `intent_score_points ?? score` as customPoints;
    // the helper applies `?? defaultPoints` last, reproducing the previous
    // `intent_score_points ?? score ?? defaultPoints`. Closes F6 drift.
    const stamp = deriveSignalStamp(
      registryEntry,
      payload.intent_score_points ?? payload.score,
    )

    // ── Step 3.5: day-level dedup (Trigify rescans last week, every run) ──
    const existing = await findExistingSignal({
      contactId: match.contact.id,
      signalTypeId: registryEntry.id,
      signalDate: occurredAt,
      signalDetail: payload.signal_detail ?? null,
    })
    if (existing) {
      log.info(
        {
          contact_id: match.contact.id,
          signal_type_id: registryEntry.id,
          existing_signal_id: existing.id,
        },
        "[trigify] duplicate detected, skipping",
      )
      return NextResponse.json({
        ok: true,
        action: "duplicate_skipped",
        contact_id: match.contact.id,
        signal_id: existing.id,
      })
    }

    // ── Step 4: persist IntentSignal ──
    const signal = await prisma.intentSignal.create({
      data: {
        contactId: match.contact.id,
        companyId: match.contact.companyId,
        signalTypeId: registryEntry.id,
        // source/signalType/title/detail/expiresAt are INTENTIONALLY trigify-
        // specific and load-bearing downstream (Intent Feed source filter, AI
        // prompt, SignalCard, Telegram BD alerts). They legitimately diverge
        // from ingestSignal()'s canonical values, so this route is NOT routed
        // through it — only the stamp derivation is shared.
        source: "trigify",
        signalType: signalCode,
        title: registryEntry.label,
        detail:
          payload.signal_detail ?? payload.detail ?? payload.title ?? null,
        expiresAt,
        createdAt: occurredAt,
        // Allumage GATE — the stamp (intentCategory/signalLevel/points) comes
        // from deriveSignalStamp. computeIntentScore filters
        // `intentCategory != null` on the IntentSignal itself, so a Trigify
        // signal written without it scores 0 → priority level never moves →
        // no promotion → no BD alert. This stamp is the switch that makes the
        // reactive loop produce score movement once Trigify is flipped.
        points: stamp.points,
        intentCategory: stamp.intentCategory,
        signalLevel: stamp.signalLevel,
        sourceUrl: payload.post_url ?? null,
        metadata: {
          signal_detail: payload.signal_detail ?? null,
          post_url: payload.post_url ?? null,
          post_text: payload.post_text ?? null,
          competitor_name: payload.competitor_name ?? null,
          signal_source: payload.signal_source ?? null,
          match_method: match.matchMethod,
          raw_payload: payload,
        },
      },
    })

    // ── Step 5: recompute relationshipScore (sum of non-expired signals) ──
    const now = new Date()
    const allSignals = await prisma.intentSignal.findMany({
      where: { contactId: match.contact.id },
      select: { points: true, expiresAt: true },
    })
    const totalScore = allSignals
      .filter((s) => !s.expiresAt || s.expiresAt > now)
      .reduce((sum, s) => sum + s.points, 0)

    await prisma.crmContact.update({
      where: { id: match.contact.id },
      data: { relationshipScore: Math.min(totalScore, 100) },
    })

    // ── Step 6: Telegram alert (only for hot signal codes) ──
    // Company name fetched only when the contact has one; the alert
    // helper itself decides whether the signal code warrants a broadcast.
    let companyName: string | null = null
    if (match.contact.companyId) {
      const co = await prisma.company.findUnique({
        where: { id: match.contact.companyId },
        select: { name: true },
      })
      companyName = co?.name ?? null
    }
    const alertResult = await maybeAlertBDs(
      signalCode,
      {
        id: match.contact.id,
        firstName: match.contact.firstName,
        lastName: match.contact.lastName,
        companyName,
      },
      payload,
    )
    if (alertResult.failures > 0) {
      log.warn(
        {
          signal_code: signalCode,
          recipients: alertResult.recipients,
          failures: alertResult.failures,
        },
        "[trigify] some BD alerts failed to deliver",
      )
    }

    // ── Step 7: reactive layer (§4.2 adapt / §4.3 passive) ──
    // §4.1 immediate already alerted above (maybeAlertBDs). This adapts the
    // Lemlist sequence variables (immediate/rapid) or logs a passive Activity.
    // Never pauses; errors are swallowed inside the helper so the webhook
    // never fails on a reactive hiccup. Awaited so the variable update lands
    // within the request (real-time "next email" adaptation).
    const reactive = await applyReactiveLayer({
      contactId: match.contact.id,
      signalCode,
      contextSnippet:
        payload.signal_detail ?? payload.detail ?? payload.title ?? null,
    })
    log.info(
      {
        signal_code: signalCode,
        contact_id: match.contact.id,
        reactive_trigger: reactive.trigger,
        reactive_action: reactive.action,
        reactive_reason: reactive.reason,
      },
      "[trigify] reactive layer applied",
    )

    return NextResponse.json({
      ok: true,
      action: "ingested",
      contact_id: match.contact.id,
      signal_id: signal.id,
      match_method: match.matchMethod,
      signal_code: signalCode,
      alerted: alertResult.alerted,
    })
  } catch (error) {
    log.error(
      { err: serializeError(error) },
      "trigify webhook processing failed",
    )
    return NextResponse.json({ ok: true, action: "error" })
  }
}
