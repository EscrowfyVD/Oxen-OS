import { z } from "zod"

/**
 * Schemas de validation Zod pour le module CRM (core CRUD) + inbound-lead webhook.
 *
 * Convention :
 * - Un schema par opération
 * - Enums extraits du schéma Prisma pour les champs fermés (stages, types, priorities)
 * - `publicErrors: true` par défaut (routes authentifiées internes)
 *   EXCEPTION : inbound-lead webhook utilise `publicErrors: false` (entrée externe)
 * - `.partial()` pour les schemas update (standard PATCH)
 */

// ─────────────────────────────────────────────────────────────
// Primitives réutilisables
// ─────────────────────────────────────────────────────────────

const cuid = z.string().regex(/^c[a-z0-9]{24}$/i, "Must be a valid CUID")

const email = z.string().email().max(320) // RFC 5321 limit

const phoneNumber = z
  .string()
  .regex(/^[+\d\s\-()]+$/, "Phone format invalid")
  .min(5)
  .max(32)

const urlString = z.string().url().max(2048)

const isoDate = z.union([
  z.string().datetime({ offset: true }),
  z.string().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?Z?)?$/),
])

const moneyAmount = z
  .number()
  .finite()
  .refine((n) => Math.abs(n) < 1e12, "Amount out of realistic range")

// ─────────────────────────────────────────────────────────────
// Enums (valeurs observées dans le schéma Prisma + crm-config.ts)
// ─────────────────────────────────────────────────────────────

const lifecycleStage = z.enum([
  "new_lead",
  "sequence_active",
  "replied",
  "meeting_booked",
  "meeting_completed",
  "proposal_sent",
  "negotiation",
  "closed_won",
  "closed_lost",
  "client",
  "qualified",
])

const dealStage = z.enum([
  "new_lead",
  "sequence_active",
  "replied",
  "qualified", // observed in contacts/import/route.ts ACTIVE_PIPELINE_STAGES
  "meeting_booked",
  "meeting_completed",
  "proposal_sent",
  "negotiation",
  "closed_won",
  "closed_lost",
])

const contactType = z.enum(["prospect", "client", "introducer", "partner"])

const icpFit = z.enum(["tier_1", "tier_2", "tier_3"])

const relationshipStrength = z.enum(["strong", "warm", "cold", "no_relationship"])

const kycStatus = z.enum([
  "not_started",
  "in_progress",
  "documents_pending",
  "under_review",
  "approved",
  "rejected",
])

const taskPriority = z.enum(["urgent", "high", "medium", "low"])
const taskStatus = z.enum(["pending", "completed", "cancelled"])
const taskType = z.enum([
  "follow_up_email",
  "follow_up_call",
  "schedule_meeting",
  "send_proposal",
  "pre_meeting_prep",
  "post_meeting_summary",
  "conference_followup",
  "send_documents",
  "internal_discussion",
  "crm_data_update",
  "other",
])

const activityType = z.enum([
  "email_sent",
  "email_received",
  "meeting_calendly",
  "meeting_manual",
  "call_outbound",
  "call_inbound",
  "linkedin_message",
  "whatsapp_message",
  "clay_sequence_event",
  "note_added",
  "file_attached",
  "conference_encounter",
  "stage_change",
  "task_completed",
  "proposal_sent",
])

const sortDir = z.enum(["asc", "desc"])
const duplicateAction = z.enum(["skip", "update"])
const filterLogic = z.enum(["and", "or"])

// ─────────────────────────────────────────────────────────────
// CrmContact — /api/crm/contacts
// ─────────────────────────────────────────────────────────────

export const createContactSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: email,
  phone: phoneNumber.nullish(),
  linkedinUrl: urlString.nullish(),
  jobTitle: z.string().max(200).nullish(),
  companyId: z.string().max(50).nullish(),
  vertical: z.array(z.string().max(100)).max(20).optional(),
  subVertical: z.array(z.string().max(100)).max(30).optional(),
  geoZone: z.string().max(100).nullish(),
  acquisitionSource: z.string().max(200).nullish(),
  acquisitionSourceDetail: z.string().max(500).nullish(),
  lifecycleStage: lifecycleStage.optional(),
  icpFit: icpFit.nullish(),
  contactType: contactType.optional(),
  companySize: z.string().max(50).nullish(),
  fundingStage: z.string().max(50).nullish(),
  techStack: z.array(z.string().max(100)).max(50).optional(),
  annualRevenueRange: z.string().max(50).nullish(),
  country: z.string().max(100).nullish(),
  city: z.string().max(100).nullish(),
  doNotContact: z.boolean().optional(),
  pinnedNote: z.string().max(5000).nullish(),
  telegram: z.string().max(100).nullish(),
  whatsapp: z.string().max(100).nullish(),
  website: urlString.nullish(),
  introducerId: z.string().max(50).nullish(),
  introducerVertical: z.array(z.string().max(100)).max(20).optional(),
  introducerGeo: z.string().max(100).nullish(),
  outreachGroup: z.string().max(50).nullish(),
})

export const updateContactSchema = createContactSchema.partial().extend({
  dealOwner: z.string().max(100).nullish(),
  relationshipStrength: relationshipStrength.nullish(),
  relationshipScore: z.number().int().min(0).max(100).optional(),
  aiSummary: z.string().max(5000).nullish(),
  lastInteraction: isoDate.nullish(),
  nextScheduledMeeting: isoDate.nullish(),
  totalInteractions: z.number().int().min(0).optional(),
  avgResponseTimeHours: z.number().min(0).finite().nullish(),
})

export const listContactsQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  lifecycleStage: z.string().optional(),
  vertical: z.string().optional(),
  geoZone: z.string().optional(),
  dealOwner: z.string().optional(),
  contactType: z.string().optional(),
  outreachGroup: z.string().optional(),
  lemlistCampaign: z.string().optional(),
  q: z.string().max(200).optional(),
  sortBy: z.string().max(50).optional(),
  sortDir: sortDir.optional(),
})

export const exportContactsQuery = z.object({
  lifecycleStage: z.string().optional(),
  vertical: z.string().optional(),
  geoZone: z.string().optional(),
  dealOwner: z.string().optional(),
  outreachGroup: z.string().optional(),
  contactType: z.string().optional(),
  q: z.string().max(200).optional(),
})

// ─────────────────────────────────────────────────────────────
// Contact activities — /api/crm/contacts/[id]/activities
// ─────────────────────────────────────────────────────────────

export const listActivitiesQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
})

export const createActivitySchema = z.object({
  type: activityType,
  description: z.string().max(10_000).nullish(),
  dealId: z.string().max(50).nullish(),
  metadata: z.any().optional(), // JSON blob — cast `as object` au site d'appel
  isPrivate: z.boolean().optional(),
})

// ─────────────────────────────────────────────────────────────
// Contact search / duplicates / import — /api/crm/contacts/*
// ─────────────────────────────────────────────────────────────

export const searchContactsQuery = z.object({
  q: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

export const checkDuplicatesSchema = z.object({
  emails: z.array(z.string().max(320)).min(0).max(5000),
})

/** Payload par contact lors de l'import CSV (la validation fine par ligne est gérée par la route). */
const importedContact = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: email,
  phone: phoneNumber.optional(),
  jobTitle: z.string().max(200).optional(),
  companyName: z.string().max(300).optional(),
  linkedinUrl: urlString.optional(),
  notes: z.string().max(5000).optional(),
  vertical: z.array(z.string().max(100)).max(20).optional(),
  subVertical: z.array(z.string().max(100)).max(30).optional(),
  geoZone: z.string().max(100).optional(),
  dealOwner: z.string().max(100).optional(),
  lifecycleStage: z.string().max(50).optional(),
  acquisitionSource: z.string().max(200).optional(),
  acquisitionSourceDetail: z.string().max(500).optional(),
  outreachGroup: z.string().max(50).optional(),
  dealValue: z.number().finite().optional(),
  contactType: z.string().max(50).optional(),
})

export const importContactsSchema = z.object({
  contacts: z.array(importedContact).min(1).max(10_000),
  duplicateAction: duplicateAction,
})

// ─────────────────────────────────────────────────────────────
// Company — /api/crm/companies
// ─────────────────────────────────────────────────────────────

export const createCompanySchema = z.object({
  name: z.string().min(1).max(300),
  website: urlString.nullish(),
  industry: z.string().max(100).nullish(),
  description: z.string().max(5000).nullish(),
  hqCountry: z.string().max(100).nullish(),
  hqCity: z.string().max(100).nullish(),
  vertical: z.array(z.string().max(100)).max(20).optional(),
  subVertical: z.array(z.string().max(100)).max(30).optional(),
  geoZone: z.string().max(100).nullish(),
  employeeCount: z.coerce.number().int().min(0).optional(),
  revenueRange: z.string().max(50).nullish(),
  fundingTotal: z.string().max(100).nullish(),
  techStack: z.array(z.string().max(100)).max(50).optional(),
  linkedinUrl: urlString.nullish(),
  socialProfiles: z.any().optional(), // Json field — cast au site d'appel
})

export const updateCompanySchema = createCompanySchema.partial().extend({
  domain: z.string().max(300).nullish(),
  contactsCount: z.number().int().min(0).optional(),
  activeDealsCount: z.number().int().min(0).optional(),
  totalRevenue: moneyAmount.optional(),
})

export const listCompaniesQuery = z.object({
  search: z.string().max(200).optional(),
  vertical: z.string().optional(),
  geoZone: z.string().optional(),
  industry: z.string().optional(),
  revenueRange: z.string().optional(),
  sortBy: z.string().max(50).optional(),
  sortDir: sortDir.optional(),
})

// ─────────────────────────────────────────────────────────────
// Deal — /api/crm/deals
// ─────────────────────────────────────────────────────────────

export const createDealSchema = z.object({
  dealName: z.string().min(1).max(300),
  contactId: z.string().min(1).max(50),
  companyId: z.string().max(50).nullish(),
  stage: dealStage.optional(),
  dealValue: z.coerce.number().finite().nullish(),
  dealOwner: z.string().max(100).nullish(),
  acquisitionSource: z.string().max(200).nullish(),
  acquisitionSourceDetail: z.string().max(500).nullish(),
  vertical: z.array(z.string().max(100)).max(20).optional(),
  expectedCloseDate: isoDate.nullish(),
  kycStatus: kycStatus.optional(),
  introducerId: z.string().max(50).nullish(),
  conferenceName: z.string().max(300).nullish(),
  notes: z.string().max(10_000).nullish(),
})

export const updateDealSchema = z.object({
  dealName: z.string().min(1).max(300).optional(),
  companyId: z.string().max(50).nullish(),
  stage: dealStage.optional(),
  dealValue: z.coerce.number().finite().nullish(),
  winProbability: z.number().min(0).max(1).optional(),
  dealOwner: z.string().max(100).optional(),
  acquisitionSource: z.string().max(200).nullish(),
  acquisitionSourceDetail: z.string().max(500).nullish(),
  vertical: z.array(z.string().max(100)).max(20).optional(),
  expectedCloseDate: isoDate.nullish(),
  kycStatus: kycStatus.optional(),
  introducerId: z.string().max(50).nullish(),
  conferenceName: z.string().max(300).nullish(),
  notes: z.string().max(10_000).nullish(),
  lostReason: z.string().max(500).nullish(),
  lostNotes: z.string().max(5000).nullish(),
  aiDealHealth: z.enum(["on_track", "needs_attention", "at_risk"]).nullish(),
  aiDealHealthReason: z.string().max(2000).nullish(),
})

export const listDealsQuery = z.object({
  stage: z.string().optional(),
  dealOwner: z.string().optional(),
  vertical: z.string().optional(),
  companyId: z.string().max(50).optional(),
  contactId: z.string().max(50).optional(),
  search: z.string().max(200).optional(),
  sortBy: z.string().max(50).optional(),
  sortDir: sortDir.optional(),
})

/** Transition de stage — PATCH /api/crm/deals/[id]/stage */
export const updateDealStageSchema = z.object({
  stage: dealStage,
  lostReason: z.string().max(500).optional(),
  lostNotes: z.string().max(5000).optional(),
})

// ─────────────────────────────────────────────────────────────
// CrmTask — /api/crm/tasks
// ─────────────────────────────────────────────────────────────

export const createTaskSchema = z.object({
  title: z.string().min(1).max(300),
  type: taskType,
  priority: taskPriority.optional(),
  dueDate: isoDate,
  assignee: z.string().min(1).max(100),
  contactId: z.string().max(50).nullish(),
  dealId: z.string().max(50).nullish(),
  outcomeNote: z.string().max(5000).nullish(),
})

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  type: taskType.optional(),
  priority: taskPriority.optional(),
  dueDate: isoDate.optional(),
  assignee: z.string().min(1).max(100).optional(),
  status: taskStatus.optional(),
  outcomeNote: z.string().max(5000).nullish(),
  contactId: z.string().max(50).nullish(),
  dealId: z.string().max(50).nullish(),
})

export const listTasksQuery = z.object({
  assignee: z.string().optional(),
  status: z.string().optional(),
  type: z.string().optional(),
  contactId: z.string().max(50).optional(),
  dealId: z.string().max(50).optional(),
})

// ─────────────────────────────────────────────────────────────
// SmartView — /api/crm/views
// ─────────────────────────────────────────────────────────────

export const createViewSchema = z.object({
  name: z.string().min(1).max(200),
  filters: z.any(), // JSON blob — cast au site d'appel
  filterLogic: filterLogic.optional(),
  isShared: z.boolean().optional(),
})

// ─────────────────────────────────────────────────────────────
// Inbound-lead webhook — /api/crm/webhooks/inbound-lead
// External website contact form (sender: oxen.finance public site)
// publicErrors: false used at call site
// ─────────────────────────────────────────────────────────────

export const inboundLeadSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: email,
  phone: phoneNumber.optional(),
  company: z.string().max(300).optional(),
  country: z.string().max(100).optional(),
  message: z.string().max(10_000).optional(),
  source: z.string().max(200).optional(),
  pageUrl: urlString.optional(),
})

// Note: `cuid`, `moneyAmount` exported locally used above; re-export not needed.
// Compliance/Finance _schemas.ts define their own primitives.
