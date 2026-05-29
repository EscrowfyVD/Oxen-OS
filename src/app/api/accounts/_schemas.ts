import { z } from "zod"

/**
 * Query schema for GET /api/accounts (Sprint 3d B5 fuzzy match).
 *
 * `q` is the single search input. `limit` caps the response — small
 * because the use case is interactive account-picker resolution
 * (operators see top hits, not pages).
 */
export const accountsSearchQuery = z.object({
  q: z.string().min(1).max(200),
  limit: z.coerce.number().int().min(1).max(25).optional().default(10),
})

export type AccountsSearchParsed = z.infer<typeof accountsSearchQuery>

/**
 * Union response shape decided in Recon D8 — fits the
 * /api/signals account-lookup use case where callers don't know
 * upfront whether the target is a Company or a CrmContact.
 *
 * `displayName` is what the picker UI surfaces. `score` is the
 * tiered relevance result (exact > starts-with > contains).
 */
export interface AccountSearchHit {
  kind: "company" | "contact"
  id: string
  displayName: string
  score: number
  jurisdiction?: string | null
  email?: string | null
}
