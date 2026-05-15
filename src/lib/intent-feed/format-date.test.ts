import { describe, it, expect } from "vitest"
import { formatSignalDate } from "./format-date"

describe("formatSignalDate", () => {
  it("formats a valid Date into 'D Mon HH:MM' en-GB", () => {
    // Note: explicit UTC construction so the test is timezone-stable
    // when CI runs in a non-Europe locale. We assert the *shape* via
    // a regex rather than a literal string to avoid TZ flakes when
    // the test runner sits in a different offset than the dev box.
    const d = new Date("2026-05-14T14:32:00Z")
    const out = formatSignalDate(d)
    expect(out).toMatch(/^\d{1,2} \w{3} \d{2}:\d{2}$/)
  })

  it("returns empty string for null / undefined / unparseable input", () => {
    expect(formatSignalDate(null)).toBe("")
    expect(formatSignalDate(undefined)).toBe("")
    expect(formatSignalDate("not-a-date")).toBe("")
  })
})
