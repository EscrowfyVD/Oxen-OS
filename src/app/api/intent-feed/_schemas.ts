import { z } from "zod"

/**
 * Query-string schema for GET /api/intent-feed.
 *
 * `validateSearchParams` flattens dup keys to last-wins, so multi-value
 * filters (e.g. source=trigify&source=clay) collapse to one. V1 keeps
 * single-value filters intentionally — if a multi-select is needed,
 * a follow-up sprint switches to `getAll()` consumption.
 *
 * `hot_only` accepts "1"/"0" or "true"/"false" via z.coerce.boolean,
 * which treats any non-empty string as true. The UI sends "1" when
 * the checkbox is checked, "" / absent otherwise.
 */
export const intentFeedFiltersSchema = z.object({
  source: z.string().max(50).optional(),
  signal_type_code: z.string().max(100).optional(),
  date_from: z.string().datetime({ offset: true }).optional(),
  date_to: z.string().datetime({ offset: true }).optional(),
  group: z.enum(["G1", "G2", "G3", "G4", "G5", "G6"]).optional(),
  // Sprint 3d Option C — single-select priority level filter. Excluded
  // is intentionally NOT exposed via this dropdown (operators don't
  // want excluded accounts surfaced); a separate ?include_excluded
  // toggle can ship in V2 if BDs need it.
  priority_level: z.enum(["P1", "P2", "P3", "Monitor"]).optional(),
  hot_only: z
    .string()
    .optional()
    .transform((v) => v === "1" || v === "true"),
  status: z.enum(["actioned", "unactioned", "all"]).optional(),
  sort: z.enum(["proxy_score_desc", "date_desc"]).optional().default("date_desc"),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
})

export type IntentFeedFiltersParsed = z.infer<typeof intentFeedFiltersSchema>
