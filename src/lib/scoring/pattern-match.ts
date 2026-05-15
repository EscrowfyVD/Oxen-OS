// Pattern Match — the 5th ICP factor (max 5 pts).
//
// Compares a prospect's profile against past `closed_won` deals to
// detect lookalike patterns. Strong match (3/3 dimensions: type +
// size + jurisdiction) wins; partial (2/3) is the consolation tier.
//
// V1 limitation (Recon Decision D7): the Oxen DB currently has 0
// closed_won Deals, so this function returns `noMatch` for every
// account until the dataset grows. The graceful-fallback branch is
// the most-exercised path V1 — the strong/partial branches are
// tested with synthetic fixtures so the behavior is locked in for
// when real deals start landing.

import { prisma } from "@/lib/prisma"
import type { ScoringConfigBlob } from "./config-types"

export type PatternMatchLevel = "strong" | "partial" | "none"

export interface PatternMatchResult {
  match: PatternMatchLevel
  points: number
  /** Count of past deals contributing to the winning tier. */
  matchedCount: number
  /**
   * Dimensions of the best match found (for explain UI). For "none"
   * all are false; for "partial" exactly two are true and reflect
   * the actual dimensions matched by the best partial deal; for
   * "strong" all three are true.
   */
  dimensions: { type: boolean; size: boolean; jurisdiction: boolean }
}

export interface AccountProfile {
  group: string | null
  companySize: string | null
  /** Country / jurisdiction. */
  jurisdiction: string | null
}

/**
 * Walk past closed_won deals and aggregate dimension matches. Pure
 * once given the deals list — extracted for testability without DB.
 */
function classifyMatches(
  account: AccountProfile,
  deals: Array<{
    contact: { group: string | null; company: { country: string | null; companySize: string | null } | null } | null
    company: { country: string | null; companySize: string | null } | null
  }>,
): {
  strongCount: number
  partialCount: number
  bestPartial: { type: boolean; size: boolean; jurisdiction: boolean } | null
} {
  let strongCount = 0
  let partialCount = 0
  let bestPartial: { type: boolean; size: boolean; jurisdiction: boolean } | null = null

  for (const deal of deals) {
    // Company resolution mirrors the Intent Feed precedence:
    // contact.company first (the contact's employer), then the
    // standalone company FK on the Deal itself.
    const dealCompany = deal.contact?.company ?? deal.company ?? null
    const dealGroup = deal.contact?.group ?? null

    const typeMatch = dealGroup !== null && dealGroup === account.group
    const sizeMatch =
      dealCompany?.companySize !== undefined &&
      dealCompany?.companySize !== null &&
      dealCompany.companySize === account.companySize
    const jurisdictionMatch =
      dealCompany?.country !== undefined &&
      dealCompany?.country !== null &&
      dealCompany.country === account.jurisdiction

    const dims = { type: typeMatch, size: sizeMatch, jurisdiction: jurisdictionMatch }
    const matchedDimensions = [typeMatch, sizeMatch, jurisdictionMatch].filter(Boolean).length

    if (matchedDimensions === 3) {
      strongCount++
    } else if (matchedDimensions === 2) {
      partialCount++
      // Keep the first partial we see — gives explain UI a real
      // dimension pattern rather than a synthetic one.
      if (!bestPartial) bestPartial = dims
    }
  }

  return { strongCount, partialCount, bestPartial }
}

export async function computePatternMatch(
  account: AccountProfile,
  config: ScoringConfigBlob,
): Promise<PatternMatchResult> {
  const wonDeals = await prisma.deal.findMany({
    where: { stage: "closed_won" },
    select: {
      contact: {
        select: {
          group: true,
          company: { select: { country: true, companySize: true } },
        },
      },
      company: { select: { country: true, companySize: true } },
    },
  })

  if (wonDeals.length === 0) {
    // V1 graceful fallback — see file-level comment.
    return {
      match: "none",
      points: config.icpFactors.patternMatch.noMatch,
      matchedCount: 0,
      dimensions: { type: false, size: false, jurisdiction: false },
    }
  }

  const { strongCount, partialCount, bestPartial } = classifyMatches(account, wonDeals)

  if (strongCount > 0) {
    return {
      match: "strong",
      points: config.icpFactors.patternMatch.strongMatch,
      matchedCount: strongCount,
      dimensions: { type: true, size: true, jurisdiction: true },
    }
  }
  if (partialCount > 0) {
    return {
      match: "partial",
      points: config.icpFactors.patternMatch.partialMatch,
      matchedCount: partialCount,
      // bestPartial is guaranteed non-null when partialCount > 0.
      dimensions: bestPartial ?? { type: false, size: false, jurisdiction: false },
    }
  }

  return {
    match: "none",
    points: config.icpFactors.patternMatch.noMatch,
    matchedCount: 0,
    dimensions: { type: false, size: false, jurisdiction: false },
  }
}
