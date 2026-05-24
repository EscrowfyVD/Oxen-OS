import { describe, it, expect } from "vitest"
import { formatTimestamp, classifyIdle, statusColor, riskColor } from "./format"

describe("formatTimestamp", () => {
  it("formats a valid ISO into 'D Mon HH:MM' (no comma)", () => {
    const out = formatTimestamp("2026-05-14T14:32:00Z")
    expect(out).toMatch(/^\d{1,2} \w{3} \d{2}:\d{2}$/)
    expect(out).not.toContain(",")
  })
  it("returns empty string for null / undefined / unparseable input", () => {
    expect(formatTimestamp(null)).toBe("")
    expect(formatTimestamp(undefined)).toBe("")
    expect(formatTimestamp("not-a-date")).toBe("")
  })
})

describe("classifyIdle", () => {
  it("null → fresh + '—' (no operator concern, no data)", () => {
    expect(classifyIdle(null)).toEqual({ bucket: "fresh", label: "—" })
  })
  it("0 min → fresh", () => {
    expect(classifyIdle(0)).toEqual({ bucket: "fresh", label: "0 min" })
  })
  it("29 min → fresh", () => {
    expect(classifyIdle(29).bucket).toBe("fresh")
  })
  it("30 min boundary → warm (operator warning)", () => {
    expect(classifyIdle(30).bucket).toBe("warm")
  })
  it("90 min → warm + 'Xh Ym' label", () => {
    const out = classifyIdle(90)
    expect(out.bucket).toBe("warm")
    expect(out.label).toBe("1h 30m")
  })
  it("120 min boundary → stuck (definitely needs attention)", () => {
    expect(classifyIdle(120).bucket).toBe("stuck")
  })
  it("1500 min (>1d) → stuck + day label", () => {
    const out = classifyIdle(1500)
    expect(out.bucket).toBe("stuck")
    expect(out.label).toMatch(/^\d+d \d+h$/)
  })
})

describe("statusColor", () => {
  it("returns canonical color for the 5 real OCA KybSession.status values", () => {
    // SP16-002b — verified against OCA staging on 2026-05-22.
    expect(statusColor("active")).toBe("#3B82F6")
    expect(statusColor("review")).toBe("#FBBF24")
    expect(statusColor("paused")).toBe("#9CA3AF")
    expect(statusColor("rejected")).toBe("#F87171")
    expect(statusColor("completed")).toBe("#34D399")
  })
  it("falls back to neutral gray for unknown statuses (no crash)", () => {
    expect(statusColor("totally_new_status")).toBe("#9CA3AF")
  })
})

describe("riskColor", () => {
  it("returns canonical color for the 2 real OCA RiskLevel values", () => {
    // SP16-005 — verified against
    // /Users/vd/Code/oxen-compliance-agent/prisma/schema.prisma on
    // 2026-05-24. Only 2 values upstream; the SP16-002 RISK_COLOR
    // keyed on low/medium/high/critical (a guess) — the actual
    // `standard` value rendered as gray, which this fix corrects.
    expect(riskColor("standard")).toBe("#34D399")
    expect(riskColor("high")).toBe("#F87171")
  })
  it("null / unknown → neutral gray", () => {
    expect(riskColor(null)).toBe("#9CA3AF")
    expect(riskColor("very_high")).toBe("#9CA3AF")
    // Legacy SP16-002 values (low/medium/critical) are NOT in the
    // OCA enum — they now fall through to the gray fallback. This
    // assertion locks in the pinned behavior.
    expect(riskColor("low")).toBe("#9CA3AF")
    expect(riskColor("medium")).toBe("#9CA3AF")
    expect(riskColor("critical")).toBe("#9CA3AF")
  })
})
