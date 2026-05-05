// Helpers for Clay enrichment pipeline (PRD-001 Sprint S0).
// Pure functions + 1 DB-bound assignment helper.
// Refs: CLAY_ENRICHMENT_PAYLOAD_DRAFT.md v1.1 sections 4.2, 10 (D1).

import { prisma } from "@/lib/prisma"

/**
 * Decision-Maker keywords (D1, Vernon 2026-05-05).
 * Lowercase substrings — first match wins.
 */
const DM_KEYWORDS = [
  "ceo",
  "founder",
  "owner",
  "managing director",
  "chief",
  "president",
  "partner",
  "director",
] as const

/**
 * Classify a job title as DM (Decision Maker) or OP (Operations).
 *
 * Returns null if jobTitle is null/undefined/empty — caller should
 * decide whether to default to OP, leave null, or trigger a manual
 * review.
 */
export function classifyPersona(
  jobTitle?: string | null,
): "DM" | "OP" | null {
  if (!jobTitle || jobTitle.trim() === "") return null
  const lowered = jobTitle.toLowerCase()
  if (DM_KEYWORDS.some((kw) => lowered.includes(kw))) return "DM"
  return "OP"
}

/**
 * Extract the segment (filter description) from a Clay table source name.
 *
 * Convention: `vDC_{group}_Tier {tier}_{scope}_{filter}`
 * Example   : `vDC_G1_Tier 1_Company_Active Business Loss`
 *           → "Active Business Loss"
 *
 * Returns null if the table name doesn't match the expected pattern,
 * or if the segment portion is empty/whitespace-only.
 */
export function extractClayTableSegment(sourceTable: string): string | null {
  const match = sourceTable.match(/_(?:Company|People)_(.+)$/)
  if (!match) return null
  const segment = match[1].trim()
  return segment.length > 0 ? segment : null
}

/**
 * Random 50/50 BD assignment for new contacts created via Clay enrichment.
 *
 * Reads the comma-separated list of BD emails from `CRM_BD_EMAILS` env
 * var (e.g. "andy@oxen.finance,paullouis@oxen.finance"), looks up active
 * Employee records matching those emails, and returns one ID at random
 * (uniform distribution across N matched BDs — 50/50 if exactly 2).
 *
 * Returns null if:
 * - env var is unset or empty
 * - no matching active Employee found
 *
 * Caller should NOT fail the import on null return — leave dealOwnerId
 * unassigned and surface in admin UI for manual triage.
 */
export async function assignRandomBD(): Promise<string | null> {
  const emailsEnv = process.env.CRM_BD_EMAILS ?? ""
  const emails = emailsEnv
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0)
  if (emails.length === 0) return null

  const bds = await prisma.employee.findMany({
    where: {
      email: { in: emails, mode: "insensitive" },
      isActive: true,
    },
    select: { id: true },
  })

  if (bds.length === 0) return null

  const idx = Math.floor(Math.random() * bds.length)
  return bds[idx].id
}
