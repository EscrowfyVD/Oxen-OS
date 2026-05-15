// Cached fetch of the active ScoringConfig blob.
//
// Single source of truth for "what config is currently in use" across
// the scoring engine, the Intent Feed sort, and the future admin UI.
// Caches the validated blob in a module-scoped variable with a 60s
// TTL — keeps the hot path under 1ms once warm, while keeping the
// invalidation surface tiny (a single `invalidateScoringConfigCache()`
// call after an admin-side write).
//
// No Redis dep V1 (Recon Decision D10): the request volume is low
// enough that 1-of-N Next.js serverless instances paying a DB round
// every 60s is negligible. If we move to a shared cache later, only
// this file needs to change.

import { prisma } from "@/lib/prisma"
import { validateScoringConfig } from "./config-validation"
import type { ScoringConfigBlob } from "./config-types"

const TTL_MS = 60_000 // 60 seconds

interface CachedConfig {
  config: ScoringConfigBlob
  ts: number
}

// Module-scoped — survives across requests within the same Node
// process. Reset on cold start (acceptable: next request re-fetches).
let cached: CachedConfig | null = null

/**
 * Fetch the currently-active ScoringConfig. Caches the validated
 * blob for `TTL_MS`. Re-fetches on miss, on staleness, and after an
 * explicit `invalidateScoringConfigCache()`.
 *
 * Throws if:
 *   - no `isActive=true` row exists in DB (seed-scoring-config not run)
 *   - the stored blob fails Zod validation (drift from manual edit)
 *
 * Both are configuration errors, not user-input errors — letting them
 * throw surfaces them in logs/alerts immediately rather than letting
 * the scoring engine silently produce wrong scores.
 *
 * Accepts an optional `now` (for tests) — defaults to `Date.now()`.
 */
export async function getActiveScoringConfig(
  now: number = Date.now(),
): Promise<ScoringConfigBlob> {
  if (cached && now - cached.ts < TTL_MS) {
    return cached.config
  }

  const row = await prisma.scoringConfig.findFirst({
    where: { isActive: true },
    orderBy: { version: "desc" },
    select: { config: true, version: true },
  })

  if (!row) {
    throw new Error(
      "No active ScoringConfig found in DB. Run " +
        "`npx tsx scripts/db/seed-scoring-config.ts` to seed v1.",
    )
  }

  const validation = validateScoringConfig(row.config)
  if (!validation.ok) {
    throw new Error(
      `Active ScoringConfig (version=${row.version}) is invalid: ${validation.error}. ` +
        `Details: ${JSON.stringify(validation.details)}`,
    )
  }

  cached = { config: validation.data, ts: now }
  return validation.data
}

/**
 * Drop the cache so the next `getActiveScoringConfig()` call re-reads
 * from DB. Call this after admin-side writes (V2 admin UI POST
 * handler) so the new config propagates within the same request.
 *
 * In V1, the cache TTL alone provides eventual consistency (60s)
 * which is fine for the seed-once flow. This export exists so V2 can
 * adopt immediate consistency without changing the loader contract.
 */
export function invalidateScoringConfigCache(): void {
  cached = null
}
