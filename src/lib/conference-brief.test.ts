// Unit tests for the pure formatting + date math layer of the
// monthly Conference Brief. No mocks needed — the functions take
// `now` / Date inputs explicitly so tests pin time deterministically.

import { describe, it, expect } from "vitest"
import {
  getCurrentMonthRange,
  formatDateRange,
  formatConferenceBriefHTML,
  type ConferenceBriefEntry,
} from "./conference-brief"

// ─────────────────────────────────────────────────────────────────────
// getCurrentMonthRange
// ─────────────────────────────────────────────────────────────────────
describe("getCurrentMonthRange", () => {
  it("computes May 2026 boundaries from a mid-May timestamp", () => {
    const now = new Date("2026-05-15T14:30:00Z")
    const r = getCurrentMonthRange(now)
    expect(r.monthStart.toISOString()).toBe("2026-05-01T00:00:00.000Z")
    expect(r.monthEnd.toISOString()).toBe("2026-06-01T00:00:00.000Z")
    expect(r.monthName).toBe("May 2026")
  })

  it("handles December → January year rollover", () => {
    const now = new Date("2026-12-15T00:00:00Z")
    const r = getCurrentMonthRange(now)
    expect(r.monthStart.toISOString()).toBe("2026-12-01T00:00:00.000Z")
    expect(r.monthEnd.toISOString()).toBe("2027-01-01T00:00:00.000Z")
    expect(r.monthName).toBe("December 2026")
  })

  it("handles edge case: timestamp exactly on month boundary (1st 00:00 UTC)", () => {
    // June 1st 00:00 UTC → should resolve to June, not May.
    const now = new Date("2026-06-01T00:00:00Z")
    const r = getCurrentMonthRange(now)
    expect(r.monthStart.toISOString()).toBe("2026-06-01T00:00:00.000Z")
    expect(r.monthEnd.toISOString()).toBe("2026-07-01T00:00:00.000Z")
    expect(r.monthName).toBe("June 2026")
  })

  it("handles February in a non-leap year (28 days)", () => {
    const now = new Date("2026-02-15T12:00:00Z")
    const r = getCurrentMonthRange(now)
    expect(r.monthStart.toISOString()).toBe("2026-02-01T00:00:00.000Z")
    expect(r.monthEnd.toISOString()).toBe("2026-03-01T00:00:00.000Z")
  })

  it("handles February in a leap year (29 days)", () => {
    // 2028 is a leap year. monthEnd is still March 1st (range
    // semantics are date-anchored, not day-count-anchored).
    const now = new Date("2028-02-15T12:00:00Z")
    const r = getCurrentMonthRange(now)
    expect(r.monthStart.toISOString()).toBe("2028-02-01T00:00:00.000Z")
    expect(r.monthEnd.toISOString()).toBe("2028-03-01T00:00:00.000Z")
  })

  it("uses UTC semantics — a late-evening local time still resolves to the UTC date's month", () => {
    // 11:30 PM Pacific on the last day of May = June 1st 06:30 UTC,
    // which falls in June UTC.
    const now = new Date("2026-06-01T06:30:00Z") // = May 31 23:30 PDT
    const r = getCurrentMonthRange(now)
    expect(r.monthName).toBe("June 2026")
  })
})

// ─────────────────────────────────────────────────────────────────────
// formatDateRange
// ─────────────────────────────────────────────────────────────────────
describe("formatDateRange", () => {
  it('formats a single-day conference (no endDate) as "May 5"', () => {
    const start = new Date("2026-05-05T00:00:00Z")
    expect(formatDateRange(start, null)).toBe("May 5")
  })

  it('formats same-day start and end as "May 5"', () => {
    const start = new Date("2026-05-05T00:00:00Z")
    const end = new Date("2026-05-05T00:00:00Z")
    expect(formatDateRange(start, end)).toBe("May 5")
  })

  it('formats same-month range as "May 5-7"', () => {
    const start = new Date("2026-05-05T00:00:00Z")
    const end = new Date("2026-05-07T00:00:00Z")
    expect(formatDateRange(start, end)).toBe("May 5-7")
  })

  it('formats cross-month range as "May 28 - Jun 2"', () => {
    const start = new Date("2026-05-28T00:00:00Z")
    const end = new Date("2026-06-02T00:00:00Z")
    expect(formatDateRange(start, end)).toBe("May 28 - Jun 2")
  })

  it('formats cross-year range as "Dec 30 - Jan 2" (no year shown)', () => {
    const start = new Date("2026-12-30T00:00:00Z")
    const end = new Date("2027-01-02T00:00:00Z")
    // Year context is in the brief heading; not duplicated in each entry.
    expect(formatDateRange(start, end)).toBe("Dec 30 - Jan 2")
  })

  it("does not pad day numbers with leading zeros", () => {
    const start = new Date("2026-05-05T00:00:00Z")
    const end = new Date("2026-05-09T00:00:00Z")
    expect(formatDateRange(start, end)).toBe("May 5-9")
    expect(formatDateRange(start, end)).not.toContain("0")
  })
})

// ─────────────────────────────────────────────────────────────────────
// formatConferenceBriefHTML
// ─────────────────────────────────────────────────────────────────────

const baseConference = (
  overrides: Partial<ConferenceBriefEntry> = {},
): ConferenceBriefEntry => ({
  name: "SiGMA Europe",
  location: "Ta' Qali",
  country: "Malta",
  startDate: new Date("2027-05-03T00:00:00Z"),
  endDate: new Date("2027-05-05T00:00:00Z"),
  description: "Premier gaming and technology summit.",
  website: "https://sigma.world",
  ...overrides,
})

describe("formatConferenceBriefHTML", () => {
  it("happy path: 2 conferences with location/country/dates/description", () => {
    const html = formatConferenceBriefHTML({
      monthName: "May 2027",
      conferences: [
        baseConference(),
        baseConference({
          name: "Token2049",
          location: "Dubaï",
          country: "UAE",
          startDate: new Date("2027-05-12T00:00:00Z"),
          endDate: new Date("2027-05-13T00:00:00Z"),
          description: "Largest digital asset conference in the Middle East.",
        }),
      ],
    })
    expect(html).toContain("<b>Conferences — May 2027</b>")
    expect(html).toContain("<b>SiGMA Europe</b>")
    expect(html).toContain("Ta' Qali, Malta — May 3-5")
    expect(html).toContain("Premier gaming and technology summit.")
    expect(html).toContain("<b>Token2049</b>")
    expect(html).toContain("Dubaï, UAE — May 12-13")
  })

  it("empty month: emits a polite fallback line", () => {
    const html = formatConferenceBriefHTML({
      monthName: "June 2027",
      conferences: [],
    })
    expect(html).toBe(
      "<b>Conferences — June 2027</b>\n\nNo conferences listed for this month.",
    )
  })

  it("country=null: renders location alone without trailing comma", () => {
    const html = formatConferenceBriefHTML({
      monthName: "May 2027",
      conferences: [baseConference({ country: null })],
    })
    expect(html).toContain("Ta' Qali — May 3-5")
    expect(html).not.toContain("Ta' Qali,")
  })

  it("description=null: skips the description line entirely (no placeholder)", () => {
    const html = formatConferenceBriefHTML({
      monthName: "May 2027",
      conferences: [baseConference({ description: null })],
    })
    // Sanity: name + location/dates still there
    expect(html).toContain("<b>SiGMA Europe</b>")
    expect(html).toContain("Ta' Qali, Malta — May 3-5")
    // No description placeholder, no orphan whitespace
    expect(html).not.toContain("(no description)")
    expect(html).not.toContain("TBD")
    // Block has exactly 2 lines (name + loc/date) before the trailing newline
    const block = html.split("\n\n").slice(1).join("\n\n").trim()
    expect(block.split("\n")).toHaveLength(2)
  })

  it('description="" (empty whitespace) is also skipped', () => {
    const html = formatConferenceBriefHTML({
      monthName: "May 2027",
      conferences: [baseConference({ description: "   " })],
    })
    const block = html.split("\n\n").slice(1).join("\n\n").trim()
    expect(block.split("\n")).toHaveLength(2)
  })

  it("HTML-escapes <, >, & in name/location/description", () => {
    // Note: Telegram's HTML parse mode only requires escaping
    // <, >, & in text content (not " — quotes are safe outside
    // attribute values). The escHtml helper from src/lib/telegram.ts
    // matches that minimum. We test the 3 chars that matter.
    const html = formatConferenceBriefHTML({
      monthName: "May 2027",
      conferences: [
        baseConference({
          name: "Conf <Web3 & AI> 2027",
          location: "Hôtel & Resort",
          country: null,
          description: "Topics: <fintech> & blockchain",
        }),
      ],
    })
    expect(html).toContain("Conf &lt;Web3 &amp; AI&gt; 2027")
    expect(html).toContain("Hôtel &amp; Resort")
    expect(html).toContain("Topics: &lt;fintech&gt; &amp; blockchain")
    // Raw unescaped tags should not appear inside the conference body
    // (only inside our own <b>...</b> markup which the template owns).
    expect(html).not.toContain("<Web3")
    expect(html).not.toContain("<fintech>")
  })

  it("escapes the monthName too (defensive — even though it's machine-generated)", () => {
    // Synthetic edge case — if a future caller passes an unsafe
    // monthName, the heading should still escape it.
    const html = formatConferenceBriefHTML({
      monthName: "May & June 2027",
      conferences: [],
    })
    expect(html).toContain("May &amp; June 2027")
  })

  it("conferences are rendered in the order received (caller sorts)", () => {
    const html = formatConferenceBriefHTML({
      monthName: "May 2027",
      conferences: [
        baseConference({ name: "Beta" }),
        baseConference({ name: "Alpha" }),
        baseConference({ name: "Gamma" }),
      ],
    })
    const betaIdx = html.indexOf("Beta")
    const alphaIdx = html.indexOf("Alpha")
    const gammaIdx = html.indexOf("Gamma")
    expect(betaIdx).toBeLessThan(alphaIdx)
    expect(alphaIdx).toBeLessThan(gammaIdx)
  })

  it("renders cross-month date range correctly", () => {
    const html = formatConferenceBriefHTML({
      monthName: "May 2027",
      conferences: [
        baseConference({
          startDate: new Date("2027-05-28T00:00:00Z"),
          endDate: new Date("2027-06-02T00:00:00Z"),
        }),
      ],
    })
    expect(html).toContain("May 28 - Jun 2")
  })

  it("renders single-day conference (no endDate) correctly", () => {
    const html = formatConferenceBriefHTML({
      monthName: "May 2027",
      conferences: [
        baseConference({
          startDate: new Date("2027-05-15T00:00:00Z"),
          endDate: null,
        }),
      ],
    })
    expect(html).toContain("Ta' Qali, Malta — May 15")
  })
})
