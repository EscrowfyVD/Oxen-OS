// Shape the raw Prisma IntentSignal row (with eager includes) into
// the JSON payload the UI cards consume. Centralizes the
// computeProxyScore + isHot + actioned_at extraction in one place so
// the page renderer doesn't have to know about metadata path digging.

import { computeProxyScore, isHot } from "./proxy-score"

// Minimal subset of the eager-loaded row shape this formatter needs.
// We intentionally don't type against Prisma's generated includes
// helpers because the formatter is the boundary between DB and UI —
// loose-typed input here keeps the API route free to pick its own
// `select` clauses without retyping the formatter signature each time.
export interface RawIntentSignalForFeed {
  id: string
  source: string
  signalType: string
  title: string
  detail: string | null
  points: number
  decayedPoints: number | null
  expiresAt: Date | null
  metadata: unknown
  sourceUrl: string | null
  createdAt: Date
  contactId: string | null
  companyId: string | null
  contact: {
    id: string
    firstName: string
    lastName: string
    email: string
    jobTitle: string | null
    linkedinUrl: string | null
    group: string | null
    painTier: string | null
    persona: string | null
    company: { id: string; name: string; country: string | null } | null
  } | null
  company: { id: string; name: string; country: string | null } | null
  signalTypeRef: {
    id: string
    code: string
    label: string
    category: string
    defaultPoints: number
    decayDays: number
  }
}

export interface IntentFeedSignal {
  id: string
  source: string
  signalTypeCode: string
  signalTypeLabel: string
  category: string
  title: string
  detail: string | null
  points: number
  proxyScore: number
  isHot: boolean
  createdAt: string // ISO — leave formatting to the UI per its locale
  expiresAt: string | null
  sourceUrl: string | null
  actionedAt: string | null
  actionedBy: string | null
  contact: {
    id: string
    name: string
    email: string
    jobTitle: string | null
    linkedinUrl: string | null
    group: string | null
    painTier: string | null
    persona: string | null
  } | null
  company: {
    id: string
    name: string
    country: string | null
  } | null
  metadata: Record<string, unknown> | null
}

interface ActionedMetadata {
  actioned_at?: string
  actioned_by?: string
}

/**
 * Shape a single raw row into the API-facing IntentFeedSignal.
 *
 * The contact/company branching reflects the schema's optionality:
 *   - contact + contact.company present → person-anchored signal
 *   - contact null, company present → company-anchored signal
 *     (e.g. a future "company funded" signal with no specific lead)
 *   - both null → orphan signal, surfaced anyway (rare; matches the
 *     /api/signals route's tolerance for company-less market signals
 *     that get filed under IntentSignal by mistake)
 */
export function formatSignal(
  row: RawIntentSignalForFeed,
  now: Date = new Date(),
): IntentFeedSignal {
  const proxyScore = computeProxyScore(row.points, row.createdAt, now)
  const meta =
    row.metadata && typeof row.metadata === "object"
      ? (row.metadata as Record<string, unknown>)
      : null

  const actioned: ActionedMetadata =
    meta && typeof meta === "object" ? (meta as ActionedMetadata) : {}

  // Company resolution priority:
  //  1. contact.company (the contact's company per schema)
  //  2. row.company (company-anchored signal with no contact)
  const resolvedCompany = row.contact?.company ?? row.company ?? null

  return {
    id: row.id,
    source: row.source,
    signalTypeCode: row.signalTypeRef.code,
    signalTypeLabel: row.signalTypeRef.label,
    category: row.signalTypeRef.category,
    title: row.title,
    detail: row.detail,
    points: row.points,
    proxyScore: Math.round(proxyScore * 100) / 100, // 2-decimal precision
    isHot: isHot(proxyScore),
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    sourceUrl: row.sourceUrl,
    actionedAt: typeof actioned.actioned_at === "string" ? actioned.actioned_at : null,
    actionedBy: typeof actioned.actioned_by === "string" ? actioned.actioned_by : null,
    contact: row.contact
      ? {
          id: row.contact.id,
          name: `${row.contact.firstName} ${row.contact.lastName}`.trim(),
          email: row.contact.email,
          jobTitle: row.contact.jobTitle,
          linkedinUrl: row.contact.linkedinUrl,
          group: row.contact.group,
          painTier: row.contact.painTier,
          persona: row.contact.persona,
        }
      : null,
    company: resolvedCompany,
    metadata: meta,
  }
}
