// Smoke tests for ScreeningPanel — verifies the empty-state fix
// (the bug that prompted SP16-002b §4 minor) plus per-result rows.

import { describe, it, expect } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { createElement } from "react"
import ScreeningPanel from "./ScreeningPanel"
import type { ScreeningSummary } from "./detail-types"

function html(screening: ScreeningSummary | null): string {
  return renderToStaticMarkup(createElement(ScreeningPanel, { screening }))
}

describe("ScreeningPanel", () => {
  it("renders empty/'none' state when screening is null", () => {
    const out = html(null)
    expect(out).toContain("Screening (0 total)")
    expect(out).toContain("No screening checks recorded yet")
  })

  it("renders empty state when total is 0 (the live OCA staging shape)", () => {
    const out = html({ total: 0, by_result: {} })
    expect(out).toContain("No screening checks recorded yet")
    // The pre-fix bug: SectionPanel showed the literal "By Result: {}"
    // — assert that artifact is gone.
    expect(out).not.toContain("By Result")
    expect(out).not.toContain("{}")
  })

  it("renders one row per result when by_result has entries", () => {
    const out = html({
      total: 3,
      by_result: { clear: 2, hit: 1 },
    })
    expect(out).toContain("Screening (3 total)")
    expect(out).toContain("clear")
    expect(out).toContain("hit")
    expect(out).not.toContain("No screening checks recorded yet")
  })

  it("normalizes snake_case result keys for display ('no_match' → 'no match')", () => {
    const out = html({ total: 1, by_result: { no_match: 1 } })
    expect(out).toContain("no match")
  })

  it("renders a count even when by_result has unknown result keys", () => {
    const out = html({ total: 1, by_result: { mysterious_new_status: 1 } })
    expect(out).toContain("mysterious new status")
    // Falls back to neutral gray for unknown keys — don't crash.
  })
})
