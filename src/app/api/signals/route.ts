import { NextResponse } from "next/server"
import { timingSafeEqual } from "crypto"
import { requirePageAccess } from "@/lib/admin"
import { validateBody } from "@/lib/validate"
import { childLoggerFromRequest, serializeError } from "@/lib/logger"
import { ingestSignal } from "@/lib/signal-ingestion"
import { signalIngestionSchema } from "./_schemas"

/**
 * POST /api/signals — universal signal ingestion endpoint
 * (Sprint S1 batch 2, refactored Sprint S1 batch 4).
 *
 * This route is now a thin HTTP wrapper around `ingestSignal()` from
 * `@/lib/signal-ingestion`:
 *   1. Auth (Bearer token OR session)
 *   2. Zod-validate the body
 *   3. Delegate to `ingestSignal()` for the actual work
 *   4. Map the IngestSignalResult onto an HTTP response
 *
 * The lib helper is also called directly by server-side consumers
 * (e.g. /api/webhooks/clay-enrichment) so they don't have to issue an
 * HTTP request to themselves.
 *
 * Auth (fail-closed):
 *   - `Authorization: Bearer <SIGNALS_INGESTION_SECRET>` for
 *     server-to-server integrations (preferred for webhooks / cron),
 *     OR
 *   - Authenticated session with CRM page access (UI calls).
 *
 * The endpoint refuses to start if SIGNALS_INGESTION_SECRET is unset
 * (matches the pattern of /api/webhooks/lemlist).
 */
export async function POST(request: Request) {
  const log = childLoggerFromRequest(request).child({ route: "signals" })

  // ── Auth (fail-closed bearer + session fallback) ──────────────────
  const ingestionSecret = process.env.SIGNALS_INGESTION_SECRET
  if (!ingestionSecret) {
    log.error(
      "SIGNALS_INGESTION_SECRET is not defined; refusing to ingest signals.",
    )
    return NextResponse.json(
      { error: "Signal ingestion secret not configured" },
      { status: 500 },
    )
  }

  const authHeader = request.headers.get("authorization") ?? ""
  const bearerMatch = /^Bearer\s+(.+)$/i.exec(authHeader)
  let authedViaBearer = false
  if (bearerMatch) {
    const provided = bearerMatch[1]
    const a = Buffer.from(provided)
    const b = Buffer.from(ingestionSecret)
    if (a.length === b.length && timingSafeEqual(a, b)) {
      authedViaBearer = true
    } else {
      // A Bearer token was provided but does not match — fail fast.
      // Falling back to session here would let attackers brute-force.
      log.warn("invalid bearer token on /api/signals")
      return NextResponse.json(
        { error: "Invalid bearer token" },
        { status: 401 },
      )
    }
  }

  if (!authedViaBearer) {
    const { error: sessionErr } = await requirePageAccess("crm")
    if (sessionErr) return sessionErr
  }

  // ── Validate body ─────────────────────────────────────────────────
  const v = await validateBody(request, signalIngestionSchema)
  if ("error" in v) return v.error
  const payload = v.data

  // ── Delegate to lib helper ────────────────────────────────────────
  const result = await ingestSignal(payload)

  if (!result.ok) {
    log.warn(
      {
        scope: payload.scope,
        signalTypeCode: payload.signalTypeCode,
        errorCode: result.code,
        details: result.details,
      },
      `signal ingestion failed: ${result.code}`,
    )
    if (result.status === 500) {
      // Persist failure — log full error trace for ops triage.
      log.error(
        { err: serializeError(result.details) },
        "signal persist failed",
      )
    }
    return NextResponse.json(
      { error: result.error, details: result.details },
      { status: result.status },
    )
  }

  log.info(
    {
      signalId: result.signal.id,
      scope: result.scope,
      // Both IntentSignal and MarketSignal carry `points`.
      points: result.signal.points,
    },
    `signal ingested (scope=${result.scope})`,
  )
  return NextResponse.json(
    { success: true, scope: result.scope, signal: result.signal },
    { status: 200 },
  )
}
