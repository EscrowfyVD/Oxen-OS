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

// ─────────────────────────────────────────────────────────────
// Clay enrichment webhook — PRD-001 scoring engine
// CLAY_ENRICHMENT_PAYLOAD_DRAFT.md v1.1 sections 3.1, 3.2, 3.3
//
// Discriminated by `scope`: "company" or "people".
// Refine ensures the corresponding sub-object is present.
// Domain and email lowercased downstream in the handler (Zod can't safely
// transform on a refined union without losing the discriminator narrowing).
// ─────────────────────────────────────────────────────────────

const crmGroup = z.enum(["G1", "G2", "G3", "G4", "G5", "G6", "G7A", "G7B"])
const crmPainTier = z.enum(["T1", "T2", "T3"])
const emailValidationStatus = z.enum(["valid", "invalid", "risky", "unknown"])

const clayCompanyPayload = z.object({
  name: z.string().min(1).max(255),
  // Apollo company descriptions can be long-form (multi-paragraph press
  // releases, "About us" copy). Bumped 2000 → 10000 in Sprint S0 batch 4
  // hotfix v2 after a 1711-row import failed because 2 rows exceeded 2000.
  description: z.string().max(10000).optional(),
  primaryIndustry: z.string().max(255).optional(),
  size: z.string().max(50).optional(),
  type: z.string().max(50).optional(),
  location: z.string().max(255).optional(),
  country: z.string().max(100).optional(),
  domain: z.string().min(1).max(255),
  linkedinUrl: z.string().url().max(500).optional(),
})

const clayPersonPayload = z.object({
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  fullName: z.string().max(255).optional(),
  jobTitle: z.string().max(255).optional(),
  email: z.string().email().max(320),
  emailValidationStatus: emailValidationStatus.optional(),
  emailProvider: z.string().max(50).optional(),
  linkedinUrl: z.string().url().max(500).optional(),
  location: z.string().max(255).optional(),
  country: z.string().max(100).optional(),
  company: z
    .object({
      name: z.string().max(255).optional(),
      domain: z.string().min(1).max(255),
      linkedinUrl: z.string().url().max(500).optional(),
    })
    .optional(),
})

// Sprint S1 batch 4 — optional signal emission on Clay enrichment.
// When a Clay payload includes a non-empty `signals[]` array, the
// webhook will emit one IntentSignal per entry after the Company /
// Contact upsert succeeds. The field is OPTIONAL — every existing
// Phase 2 G1-T1 payload (which doesn't carry it) keeps working
// unchanged.
const claySignalEntry = z.object({
  signalTypeCode: z.string().min(1).max(100),
  customPoints: z.number().int().min(0).max(10000).optional(),
  metadata: z.record(z.unknown()).optional(),
  sourceUrl: z.string().url().max(2000).optional(),
  occurredAt: z.string().datetime({ offset: true }).optional(),
  notes: z.string().max(5000).optional(),
})

export const clayEnrichmentSchema = z
  .object({
    source_table: z.string().min(1).max(200),
    scope: z.enum(["company", "people"]),
    group: crmGroup,
    pain_tier: crmPainTier,
    company: clayCompanyPayload.optional(),
    person: clayPersonPayload.optional(),
    // Optional signals emission (Sprint S1 batch 4). When omitted or
    // empty, the webhook behaves exactly as in Sprint S0 (upsert only).
    signals: z.array(claySignalEntry).max(50).optional(),
  })
  .refine(
    (data) =>
      (data.scope === "company" && data.company !== undefined) ||
      (data.scope === "people" && data.person !== undefined),
    {
      message:
        "scope=company requires `company`, scope=people requires `person`",
    },
  )

export type ClayEnrichmentPayload = z.infer<typeof clayEnrichmentSchema>
export type ClaySignalEntry = z.infer<typeof claySignalEntry>

// ─────────────────────────────────────────────────────────────
// Clay batch CSV import — /api/crm/contacts/import-clay
//
// Wraps a list of clayEnrichmentSchema rows (all sharing the same
// source_table / scope / group / pain_tier — the 4 axes are auto-detected
// in the wizard from the source_table dropdown). Each row in `rows` is
// the company OR person sub-payload (without the wrapping metadata).
//
// Sprint S0 batch 4 hotfix v2 — `rows` is intentionally `z.unknown()` at
// the batch layer. The route validates each row INDIVIDUALLY inside its
// Promise.allSettled chunk loop (using the per-row schemas exported
// below) so that a single malformed row no longer rejects the whole
// import. See route.ts for the per-row validation flow.
// ─────────────────────────────────────────────────────────────

// Per-row schemas — applied individually inside Promise.allSettled by
// /api/crm/contacts/import-clay. Exported so the route picks the right
// shape based on `payload.scope`.
export const clayBatchCompanyRowSchema = clayCompanyPayload
export const clayBatchPersonRowSchema = clayPersonPayload

export const clayBatchImportSchema = z.object({
  source_table: z.string().min(1).max(200),
  scope: z.enum(["company", "people"]),
  group: crmGroup,
  pain_tier: crmPainTier,
  // Lenient — per-row validation happens in the route (see comment above).
  rows: z.array(z.unknown()).min(1).max(5000),
})

export type ClayBatchImportPayload = z.infer<typeof clayBatchImportSchema>
