// Parse a Clay / LinkedIn `companySize` string label into a representative
// employee count, so compute-icp-score can score the Company Size factor
// when the numeric `employeeCount` is absent (Finding 2).
//
// Why this exists: the current prospect pool has `employeeCount` = NULL on
// 100% of Company rows AND `revenueRange` = NULL too — the only populated
// size signal is the `companySize` label ("11-50 employees",
// "2-10 employees", "51-200 employees", ...). Before this helper the Company
// Size factor scored 0 for every account. This turns the label into a
// number; the bracket BOUNDS stay in ScoringConfig and the existing matcher
// in compute-icp-score does the bracketing. No bracket bounds live here.
//
// Conventions (Sprint Finding 2):
//   - Range bucket "X-Y[ employees]" → midpoint, floored: floor((X+Y)/2)
//        "11-50 employees"  → 30
//        "2-10 employees"   → 6
//        "51-200 employees" → 125
//   - Open-ended bucket "X+[ employees]" → low bound X:
//        "10,001+ employees" → 10001
//   - Thousands-separator commas tolerated ("501-1,000 employees" → 750).
//   - Anything else — empty, null/undefined, "Self-employed", free text —
//     → null. The caller (computeCompanySize) maps null to the edge bucket,
//     never to 0.

export function parseCompanySizeLabel(
  label: string | null | undefined,
): number | null {
  if (!label) return null

  // Strip thousands separators so "501-1,000" / "10,001+" parse cleanly.
  const cleaned = label.replace(/,/g, "").trim()

  // Range bucket: "11-50", "2-10 employees", "501-1000 employees".
  // Checked BEFORE the open-ended form so the leading number of a range
  // is never mistaken for a bare count.
  const range = cleaned.match(/^(\d+)\s*-\s*(\d+)/)
  if (range) {
    const lo = Number(range[1])
    const hi = Number(range[2])
    return Math.floor((lo + hi) / 2)
  }

  // Open-ended bucket: "10001+", "10001+ employees" → low bound.
  const open = cleaned.match(/^(\d+)\s*\+/)
  if (open) {
    return Number(open[1])
  }

  // Non-numeric ("Self-employed"), free text, or unrecognised shape.
  return null
}
