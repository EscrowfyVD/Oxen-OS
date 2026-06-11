// ─── Apify industry-keyword relevance gate (Apify PR3b-pipeline) ────
//
// The routing gate only ingests a scraped item as a signal if its text
// (title + body/description) mentions at least one industry keyword — a
// coarse relevance filter so we don't route, say, a bakery's funding round
// or a barista job posting into the CRM as a prospect signal.
//
// ⚠️ This list is a best-effort rendering of Andy's spec keyword list,
// aligned to Oxen's 7 verticals (FinTech/Crypto, Family Office,
// CSP/Fiduciaries, Luxury Assets, iGaming, Yacht Brokers, Import/Export)
// plus the compliance / offshore / banking domain. Pending Andy's exact
// list. DB-editable keywords = a future slice (kept a const here for V1).

export const APIFY_INDUSTRY_KEYWORDS: readonly string[] = [
  // FinTech / Crypto / payments
  "fintech",
  "crypto",
  "cryptocurrency",
  "blockchain",
  "web3",
  "defi",
  "payments",
  "payment",
  "neobank",
  "banking",
  "remittance",
  "forex",
  "custody",
  "custodian",
  "escrow",
  // iGaming
  "igaming",
  "gaming",
  "gambling",
  "casino",
  "betting",
  "sportsbook",
  // Luxury / Yacht / marine
  "yacht",
  "marine",
  "superyacht",
  // Import / Export / trade
  "import",
  "export",
  "freight",
  "customs",
  "logistics",
  // Fiduciary / CSP / wealth
  "offshore",
  "fiduciary",
  "trustee",
  "trust",
  "wealth",
  "treasury",
  "brokerage",
  "broker",
  // Compliance / regulatory (also the Cat-G hiring relevance)
  "compliance",
  "kyc",
  "aml",
  "mlro",
  "regulatory",
  "sanctions",
  // Multi-word phrases
  "family office",
  "wealth management",
  "asset management",
  "private banking",
  "private wealth",
  "corporate services",
  "company formation",
  "trade finance",
  "financial crime",
  "anti money laundering",
  "virtual assets",
  "digital assets",
  "payment institution",
  "electronic money",
  "head of compliance",
  "head of kyc",
  "chief compliance officer",
  "compliance officer",
] as const

/**
 * Case-insensitive relevance check. Single-word keywords match on a whole
 * token (so "aml" does NOT match "camla" and "trust" does NOT match
 * "trusted"); multi-word phrases match as a substring. Returns true on the
 * first hit.
 */
export function matchesIndustryKeyword(text: string): boolean {
  if (!text) return false
  const lower = text.toLowerCase()
  const tokens = new Set(lower.split(/[^a-z0-9]+/).filter(Boolean))
  for (const kw of APIFY_INDUSTRY_KEYWORDS) {
    if (kw.includes(" ")) {
      if (lower.includes(kw)) return true
    } else if (tokens.has(kw)) {
      return true
    }
  }
  return false
}
