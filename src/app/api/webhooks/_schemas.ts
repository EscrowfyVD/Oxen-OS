import { z } from "zod"

/**
 * Schemas de validation Zod pour les webhooks externes.
 *
 * Convention spécifique webhooks :
 * - `publicErrors: false` systématique au site d'appel (on ne leak pas la structure au sender)
 * - Schemas strict sur les champs lus par la route, tolérants sur les champs ignorés (strip par défaut)
 * - Si l'émetteur ajoute un champ non prévu, Zod le strippe silencieusement — pas de 400
 * - Si l'émetteur retire un champ requis, Zod retourne 400 "Invalid input" sans détails
 */

// ─────────────────────────────────────────────────────────────
// Clay webhook — enrichment signals
// Payload observed in src/app/api/webhooks/clay/route.ts
// ─────────────────────────────────────────────────────────────

export const clayWebhookSchema = z.object({
  email: z.string().max(320).optional(),
  enrichment_type: z.string().max(100).optional(),
  data: z.unknown().optional(), // JSON blob stringified by the route (string|object)
  title: z.string().max(500).optional(),
  score: z.number().min(0).max(1000).optional(),
})

// ─────────────────────────────────────────────────────────────
// Lemlist webhook — outbound email events
// Payload observed in src/app/api/webhooks/lemlist/route.ts
// Lemlist uses HMAC on raw body → validated via safeParse inline in the route
// (validateBody() consumes req.json() which would break HMAC raw-body check)
// ─────────────────────────────────────────────────────────────

const lemlistEvent = z.enum([
  "emailsSent",
  "emailsOpened",
  "emailsClicked",
  "emailsReplied",
  "emailsBounced",
  "emailsUnsubscribed",
  "contacted",
  "interested",
  "notInterested",
  "hooked",
])

export const lemlistWebhookSchema = z.object({
  email: z.string().max(320).optional(),
  event: lemlistEvent,
  campaignName: z.string().max(300).optional(),
  campaignId: z.string().max(100).optional(),
})

// ─────────────────────────────────────────────────────────────
// Trigify webhook — job-change / intent signals
// Payload observed in src/app/api/webhooks/trigify/route.ts
// ─────────────────────────────────────────────────────────────

export const trigifyWebhookSchema = z.object({
  email: z.string().max(320).optional(),
  signal_type: z.string().max(100).optional(),
  title: z.string().max(500).optional(),
  detail: z.string().max(5000).optional(),
  score: z.number().min(0).max(1000).optional(),
  name: z.string().max(300).optional(),
  company: z.string().max(300).optional(),
})

// ─────────────────────────────────────────────────────────────
// N8N webhook — generic automation dispatcher
// Payload observed in src/app/api/webhooks/n8n/route.ts
//
// Discriminated union per `action` because the route accesses sub-fields of
// `data` (signalType, firstName, etc.) — typing them validates payloads
// end-to-end instead of relying on defensive `data?.X` with silent Prisma
// rejection at DB layer.
// ─────────────────────────────────────────────────────────────

const isoDateAny = z.union([
  z.string().datetime({ offset: true }),
  z.string().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?Z?)?$/),
])

const n8nCreateSignalData = z
  .object({
    signalType: z.string().max(100).optional(),
    title: z.string().max(500).optional(),
    detail: z.string().max(5000).optional(),
    score: z.number().min(0).max(1000).optional(),
    expiresAt: isoDateAny.optional(),
  })
  .optional()

/**
 * Keys whitelisted by the route for `update_contact` (matches the `allowed`
 * array in webhooks/n8n/route.ts). Any unlisted key is silently ignored by
 * the route; Zod strip reinforces that.
 */
const n8nUpdateContactData = z
  .object({
    firstName: z.string().max(100).optional(),
    lastName: z.string().max(100).optional(),
    company: z.string().max(300).optional(),
    vertical: z.string().max(100).optional(),
    lifecycleStage: z.string().max(50).optional(),
    source: z.string().max(200).optional(),
    country: z.string().max(100).optional(),
    outreachStatus: z.string().max(50).optional(),
    leadSource: z.string().max(200).optional(),
    clientType: z.string().max(50).optional(),
    dealOwner: z.string().max(100).optional(),
    introducerId: z.string().max(50).optional(),
  })
  .optional()

const n8nCreateInteractionData = z
  .object({
    type: z.string().max(50).optional(),
    content: z.string().max(5000).optional(),
  })
  .optional()

export const n8nWebhookSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create_signal"),
    contactEmail: z.string().max(320),
    data: n8nCreateSignalData,
  }),
  z.object({
    action: z.literal("update_contact"),
    contactEmail: z.string().max(320),
    data: n8nUpdateContactData,
  }),
  z.object({
    action: z.literal("create_interaction"),
    contactEmail: z.string().max(320),
    data: n8nCreateInteractionData,
  }),
])
