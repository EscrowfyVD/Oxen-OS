/**
 * Tests for formatPromotionAlert (Sprint 3d B3).
 *
 * Deterministic string assertions — render is a pure function so test
 * snapshots can pin exact wording. If a maintainer changes the
 * template, this test flags it loudly.
 */

import { describe, it, expect } from "vitest"
import { formatPromotionAlert } from "./format-promotion-alert"

const baseArgs = {
  personName: "Alice Smith",
  companyName: "Acme Trust",
  jurisdiction: "Cyprus",
  previousLevel: "Monitor" as string | null,
  newLevel: "P2",
  score: 62,
  signalCount: 4,
  contactId: "ct-abc",
}

describe("formatPromotionAlert", () => {
  // ─── [1] P1 render with 🚀 ──────────────────────────────────────
  it("[1] P1 promotion uses the 🚀 emoji", () => {
    const out = formatPromotionAlert({ ...baseArgs, newLevel: "P1" })
    expect(out.startsWith("🚀 <b>PROMOTION — Alice Smith</b>")).toBe(true)
    expect(out).toContain("<b>Level</b>: Monitor → <b>P1</b>")
    expect(out).toContain("https://os.oxen.finance/crm/contact/ct-abc")
  })

  // ─── [2] P2 render with ⬆ ──────────────────────────────────────
  it("[2] P2 promotion uses the ⬆ emoji", () => {
    const out = formatPromotionAlert(baseArgs)
    expect(out.startsWith("⬆ <b>PROMOTION — Alice Smith</b>")).toBe(true)
    expect(out).toContain("<b>Score</b>: 62 · <b>Signals</b>: 4")
  })

  // ─── [3] escHtml on company + jurisdiction ──────────────────────
  // Telegram HTML parse mode chokes on raw <, >, &. Confirms the
  // helper escapes user-controlled strings while leaving the URL
  // pass-through untouched.
  it("[3] escapes < > & in company and jurisdiction", () => {
    const out = formatPromotionAlert({
      ...baseArgs,
      companyName: "A&B <Trust>",
      jurisdiction: "Off<shore>",
    })
    expect(out).toContain("<b>Company</b>: A&amp;B &lt;Trust&gt; (Off&lt;shore&gt;)")
    // URL must NOT be escaped (Telegram links break if &amp; appears in href).
    expect(out).toContain("https://os.oxen.finance/crm/contact/ct-abc")
  })

  // ─── [4] optional topSignals branch ────────────────────────────
  it("[4] omits the top-signals line when not provided, appends when present", () => {
    const without = formatPromotionAlert(baseArgs)
    expect(without).not.toContain("Top signals")

    const withTop = formatPromotionAlert({
      ...baseArgs,
      topSignals: ["trigify_profile_visit", "clay_director_change"],
    })
    expect(withTop).toContain(
      "<b>Top signals</b>: trigify_profile_visit, clay_director_change",
    )
  })
})
