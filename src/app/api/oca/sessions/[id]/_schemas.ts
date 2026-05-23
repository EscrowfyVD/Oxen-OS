// Shared Zod schemas for the 3 SP16-003 OCA mutation routes.
//
// Schemas mirror the OCA-side schemas (operator.ts in the OCA repo)
// EXACTLY — verified via SP16-003 Step 0 live calls on 2026-05-23:
//
//   PATCH /agent       : body must be { active: boolean }
//                        (NOT `agentActive` or `agent_active`; both
//                        return 400 "Validation Error: Required")
//   POST  /messages    : body must be { message: string (1-5000) }
//                        (NOT `content`; OCA returns 400 otherwise)
//   POST  /reopen      : body is an empty object `{}` (Fastify rejects
//                        a truly empty body when content-type:json is
//                        set; the empty-object placeholder satisfies it)
//
// Validation here is defense-in-depth: OCA also validates upstream,
// but rejecting bad input locally avoids a wasted round-trip and gives
// us a fully-typed body for the proxy call site.

import { z } from "zod"

export const agentToggleBodySchema = z.object({
  active: z.boolean(),
})

export const operatorMessageBodySchema = z.object({
  // 5000 is OCA's upstream cap (operatorMessageSchema in the OCA repo).
  // Matching it locally so a too-long message fails fast with a clear
  // 400 before we burn a round-trip on a guaranteed OCA reject.
  message: z.string().min(1).max(5000),
})

// Reopen has no semantic body; the empty-object schema exists only to
// keep the proxy-side validateBody() flow uniform across the 3 routes
// and to satisfy Fastify's "non-empty JSON body" rule on the OCA side.
export const reopenBodySchema = z.object({}).strict()
