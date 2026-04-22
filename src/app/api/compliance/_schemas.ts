import { z } from "zod"

/**
 * Schemas de validation Zod pour le module Compliance.
 *
 * Convention :
 * - Enums restreints pour les champs régulatoires (status, severity, type, etc.)
 * - Scores numériques bornés (likelihood/impact 1-5, risk score calculé)
 * - Dates ISO 8601 ou "YYYY-MM-DD"
 * - Schemas d'update = `.partial()` sur le schema de création
 *
 * Note : la validation Zod ajoute en amont des contrôles que la logique métier
 * pourrait sinon rater (scores > 5, severity hors liste, etc.). C'est volontaire
 * — on durcit l'input sans toucher au comportement.
 */

// ─────────────────────────────────────────────────────────────
// Primitives communes
// ─────────────────────────────────────────────────────────────

const isoDate = z.union([
  z.string().datetime({ offset: true }),
  z.string().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?Z?)?$/),
])

const currencyCode = z
  .string()
  .regex(/^[A-Z]{3}$/, "Must be a 3-letter ISO currency code")

/** Likelihood / impact / residual on the 1-5 Prisma schema scale. */
const riskScale = z.number().int().min(1).max(5)

// ─────────────────────────────────────────────────────────────
// Enums (valeurs observées dans le schéma Prisma + routes)
// ─────────────────────────────────────────────────────────────

const policyStatus = z.enum([
  "draft",
  "pending_review",
  "approved",
  "active",
  "archived",
  "expired",
])
const priority = z.enum(["critical", "high", "medium", "low"])

const riskStatus = z.enum([
  "open",
  "mitigating",
  "accepted",
  "closed",
  "monitoring",
])

const incidentType = z.enum([
  "sar",
  "breach",
  "complaint",
  "near_miss",
  "audit_finding",
  "regulatory_inquiry",
])
const incidentSeverity = z.enum(["critical", "high", "medium", "low"])
const incidentStatus = z.enum([
  "open",
  "investigating",
  "reported",
  "resolved",
  "closed",
])

const licenseStatus = z.enum([
  "active",
  "pending",
  "suspended",
  "expired",
  "revoked",
])

const trainingStatus = z.enum(["active", "archived"])
const trainingFrequency = z.enum(["annual", "biannual", "quarterly", "one_time"])

const completionStatus = z.enum(["pending", "completed", "expired", "failed"])

const screeningType = z.enum([
  "sanctions",
  "pep",
  "adverse_media",
  "kyc",
])
const screeningSubject = z.enum(["individual", "company"])
const screeningResult = z.enum([
  "clear",
  "match",
  "potential_match",
  "pending",
])
const riskLevel = z.enum(["high", "medium", "low"])

// ─────────────────────────────────────────────────────────────
// Policy
// ─────────────────────────────────────────────────────────────

export const createPolicySchema = z.object({
  title: z.string().min(1).max(300),
  category: z.string().min(1).max(100),
  status: policyStatus.optional(),
  priority: priority.optional(),
  description: z.string().max(2000).nullish(),
  content: z.string().max(100_000).nullish(),
  entityId: z.string().max(50).nullish(),
  ownerId: z.string().max(200).nullish(),
  reviewerId: z.string().max(200).nullish(),
  effectiveDate: isoDate.nullish(),
  expiryDate: isoDate.nullish(),
  reviewDate: isoDate.nullish(),
  tags: z.array(z.string().max(50)).max(50).optional(),
})

export const updatePolicySchema = createPolicySchema.partial()

export const listPoliciesQuery = z.object({
  category: z.string().optional(),
  status: z.string().optional(),
  entityId: z.string().optional(),
  search: z.string().max(200).optional(),
})

// Policy versions (POST /compliance/policies/[id]/versions)
export const createPolicyVersionSchema = z.object({
  content: z.string().min(1).max(100_000),
  changelog: z.string().max(5000).nullish(),
})

// ─────────────────────────────────────────────────────────────
// Risk
// ─────────────────────────────────────────────────────────────

export const createRiskSchema = z.object({
  title: z.string().min(1).max(300),
  category: z.string().min(1).max(100),
  description: z.string().max(5000).nullish(),
  likelihood: riskScale.optional(),
  impact: riskScale.optional(),
  status: riskStatus.optional(),
  mitigation: z.string().max(5000).nullish(),
  residualLikelihood: riskScale.nullish(),
  residualImpact: riskScale.nullish(),
  ownerId: z.string().max(200).nullish(),
  entityId: z.string().max(50).nullish(),
  reviewDate: isoDate.nullish(),
})

export const updateRiskSchema = createRiskSchema.partial()

export const listRisksQuery = z.object({
  category: z.string().optional(),
  status: z.string().optional(),
  entityId: z.string().optional(),
  minScore: z.coerce.number().int().min(1).max(25).optional(),
})

// ─────────────────────────────────────────────────────────────
// Compliance incident
// ─────────────────────────────────────────────────────────────

export const createIncidentSchema = z.object({
  title: z.string().min(1).max(300),
  type: incidentType,
  severity: incidentSeverity.optional(),
  status: incidentStatus.optional(),
  description: z.string().max(10_000).nullish(),
  rootCause: z.string().max(10_000).nullish(),
  remediation: z.string().max(10_000).nullish(),
  entityId: z.string().max(50).nullish(),
  reportedBy: z.string().max(200).optional(),
  assignedTo: z.string().max(200).nullish(),
  reportedToRegulator: z.boolean().optional(),
  regulatorRef: z.string().max(200).nullish(),
  reportedAt: isoDate.nullish(),
  financialImpact: z.number().finite().nullish(),
  currency: currencyCode.optional(),
  tags: z.array(z.string().max(50)).max(50).optional(),
})

export const updateIncidentSchema = createIncidentSchema
  .partial()
  .omit({ reportedBy: true })

export const listIncidentsQuery = z.object({
  type: z.string().optional(),
  severity: z.string().optional(),
  status: z.string().optional(),
  entityId: z.string().optional(),
})

// ─────────────────────────────────────────────────────────────
// Regulatory license
// ─────────────────────────────────────────────────────────────

export const createLicenseSchema = z.object({
  name: z.string().min(1).max(300),
  code: z.string().max(100).nullish(),
  regulator: z.string().min(1).max(200),
  entityId: z.string().max(50).nullish(),
  entityName: z.string().max(300).nullish(),
  type: z.string().max(50).nullish(),
  status: licenseStatus.optional(),
  grantedDate: isoDate.nullish(),
  expiryDate: isoDate.nullish(),
  renewalDate: isoDate.nullish(),
  conditions: z.string().max(10_000).nullish(),
  notes: z.string().max(10_000).nullish(),
  documentUrl: z.string().url().max(2000).nullish(),
})

export const updateLicenseSchema = createLicenseSchema.partial()

export const listLicensesQuery = z.object({
  entityId: z.string().optional(),
})

// ─────────────────────────────────────────────────────────────
// Training & completion
// ─────────────────────────────────────────────────────────────

export const createTrainingSchema = z.object({
  title: z.string().min(1).max(300),
  category: z.string().min(1).max(100),
  description: z.string().max(5000).nullish(),
  provider: z.string().max(200).nullish(),
  durationHours: z.number().nonnegative().finite().nullish(),
  frequency: trainingFrequency.nullish(),
  mandatory: z.boolean().optional(),
  entityId: z.string().max(50).nullish(),
  dueDate: isoDate.nullish(),
  status: trainingStatus.optional(),
})

export const updateTrainingSchema = createTrainingSchema.partial()

export const listTrainingsQuery = z.object({
  category: z.string().optional(),
  status: z.string().optional(),
  entityId: z.string().optional(),
})

export const upsertTrainingCompletionSchema = z.object({
  employeeId: z.string().min(1).max(50),
  completedAt: isoDate.nullish(),
  expiresAt: isoDate.nullish(),
  score: z.number().min(0).max(100).nullish(),
  certificateUrl: z.string().url().max(2000).nullish(),
  status: completionStatus.optional(),
  notes: z.string().max(5000).nullish(),
})

// ─────────────────────────────────────────────────────────────
// Screening record
// ─────────────────────────────────────────────────────────────

export const createScreeningSchema = z.object({
  subjectName: z.string().min(1).max(300),
  subjectType: screeningSubject,
  screeningType: screeningType,
  result: screeningResult.optional(),
  provider: z.string().max(200).nullish(),
  matchDetails: z.any().optional(), // JSON blob — routed as-is to Prisma
  contactId: z.string().max(50).nullish(),
  riskLevel: riskLevel.nullish(),
  notes: z.string().max(10_000).nullish(),
  nextScreeningDate: isoDate.nullish(),
})

export const updateScreeningSchema = z.object({
  result: screeningResult.optional(),
  matchDetails: z.unknown().optional(),
  riskLevel: riskLevel.nullish(),
  notes: z.string().max(10_000).nullish(),
  reviewedBy: z.string().max(200).optional(),
  nextScreeningDate: isoDate.nullish(),
})

export const listScreeningsQuery = z.object({
  result: z.string().optional(),
  screeningType: z.string().optional(),
  subjectType: z.string().optional(),
})
