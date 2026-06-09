// Account-name normalization + tier→confidence matching (Apify PR2 / D2).
//
// Pure, DB-free helpers so the messy scraped-name → CRM-account match is
// unit-testable and reusable by the PR3 pipeline. The route fetches candidates
// (ILIKE on the first normalized token) and scores them with these.
//
// Why normalization: tiered scoring alone can't match "Mercury, Inc." to
// "Mercury Technologies" — the legal suffix + punctuation break it. We normalize
// BOTH sides first. No DB column, no pg_trgm (deferred); normalize on the fly.

// Legal-entity suffixes stripped from the END of a name (token-wise). Kept to
// genuine entity forms — NOT "group/holdings/company/co" (often part of the
// brand → stripping them would cause false positives, the thing we minimize).
const LEGAL_SUFFIXES = new Set([
  "ltd", "limited", "llc", "inc", "incorporated", "corp", "corporation",
  "plc", "gmbh", "ag", "sa", "sarl", "srl", "spa", "bv", "nv", "oy", "ab",
  "as", "pte", "pty", "llp", "lp", "kg", "kk",
])

/**
 * Normalize a company name for matching: lowercase, drop dots (S.A.→sa,
 * Inc.→inc), other punctuation → space, collapse whitespace, then strip
 * trailing legal-suffix tokens. Always keeps ≥1 token. Returns "" for an
 * empty / suffix-only input.
 */
export function normalizeCompanyName(raw: string): string {
  if (!raw) return ""
  let s = raw.toLowerCase()
  s = s.replace(/\./g, "") // dotted abbreviations: S.A. → sa, Inc. → inc
  s = s.replace(/[^\p{L}\p{N}\s]/gu, " ") // remaining punctuation → space
  s = s.replace(/\s+/g, " ").trim()
  const tokens = s.split(" ").filter(Boolean)
  while (tokens.length > 1 && LEGAL_SUFFIXES.has(tokens[tokens.length - 1])) {
    tokens.pop()
  }
  // suffix-only inputs (e.g. "Ltd") normalize to that single token; callers
  // treat a normalized input that equals a bare suffix as too-weak to match.
  if (tokens.length === 1 && LEGAL_SUFFIXES.has(tokens[0])) return ""
  return tokens.join(" ")
}

/**
 * Confidence (0-1) of a candidate name vs the search term, both ALREADY
 * normalized. Tiers map to the PR2 contract:
 *   exact            → 1.0
 *   whole-word starts → 0.9   ("mercury" → "mercury technologies")
 *   substring         → 0.7   ("acme" → "big acme holdings")
 *   none              → 0
 * Conservative on purpose: a 0.85 caller cutoff lets only exact + starts-with
 * through (a signal on the WRONG account is worse than a duplicate).
 */
export function matchConfidence(normInput: string, normCandidate: string): number {
  if (!normInput || !normCandidate) return 0
  if (normCandidate === normInput) return 1.0
  if (normCandidate.startsWith(normInput + " ")) return 0.9
  if (normCandidate.includes(normInput)) return 0.7
  return 0
}
