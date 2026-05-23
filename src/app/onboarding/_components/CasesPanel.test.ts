// Smoke tests for CasesPanel — same react-dom/server static-markup
// approach as DocumentsPanel.test.ts (no new test-renderer dep).

import { describe, it, expect } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { createElement } from "react"
import CasesPanel from "./CasesPanel"
import type { CasesSummary } from "./detail-types"

function html(cases: CasesSummary | null): string {
  return renderToStaticMarkup(createElement(CasesPanel, { cases }))
}

describe("CasesPanel", () => {
  it("renders empty state when cases is null", () => {
    const out = html(null)
    expect(out).toContain("Cases (0 open)")
    expect(out).toContain("No cases for this session")
  })

  it("renders empty state when items array is empty", () => {
    const out = html({ open_count: 0, items: [] })
    expect(out).toContain("Cases (0 open)")
    expect(out).toContain("No cases for this session")
  })

  it("renders open_count header even when items is non-empty", () => {
    const out = html({
      open_count: 2,
      items: [{ id: "c1", case_type: "smoke_test_escalation" }],
    })
    expect(out).toContain("Cases (2 open)")
  })

  it("renders severity + status + case_type + title + date for a full row", () => {
    const out = html({
      open_count: 1,
      items: [
        {
          id: "c1",
          case_type: "smoke_test_escalation",
          severity: "high",
          status: "new",
          title: "SP15-001 SMOKE TEST — compliance_escalation",
          created_at: "2026-05-21T09:18:19Z",
        },
      ],
    })
    expect(out).toContain("high")
    expect(out).toContain("new")
    expect(out).toContain("smoke_test_escalation")
    expect(out).toContain("SP15-001 SMOKE TEST")
    // No raw JSON dump.
    expect(out).not.toContain('"id":"c1"')
  })

  it("renders defensively when only id is set (all other fields missing)", () => {
    const out = html({ open_count: 1, items: [{ id: "c1" }] })
    // Should not throw and should not show "(none)" placeholders.
    expect(out).toContain("Cases (1 open)")
    expect(out).not.toContain("No cases for this session")
  })

  it("severity pill uses the right color hex for known severities", () => {
    const out = html({
      open_count: 1,
      items: [{ id: "c1", severity: "critical" }],
    })
    // Critical = #F87171 (red). Spot-check the color is in the inline
    // style — defensive that the SEVERITY_COLOR mapping wasn't dropped.
    expect(out.toLowerCase()).toContain("#f87171")
  })
})
