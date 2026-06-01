import { describe, it, expect } from "vitest"
import { deriveSignalStamp } from "./derive-signal-stamp"

// Minimal registry-entry shapes (only the fields the helper reads).
const categorized = {
  intentCategory: "A",
  signalLevel: "contact",
  defaultPoints: 10,
}
const placeholder = {
  intentCategory: null, // clay_legacy_intent / n8n_external_signal in prod
  signalLevel: "contact",
  defaultPoints: 10,
}

describe("deriveSignalStamp", () => {
  it("copies intentCategory + signalLevel verbatim from the entry", () => {
    const s = deriveSignalStamp(categorized)
    expect(s.intentCategory).toBe("A")
    expect(s.signalLevel).toBe("contact")
  })

  it("falls back to entry.defaultPoints when customPoints is undefined", () => {
    expect(deriveSignalStamp(categorized).points).toBe(10)
    expect(deriveSignalStamp(categorized, undefined).points).toBe(10)
  })

  it("falls back to entry.defaultPoints when customPoints is null", () => {
    expect(deriveSignalStamp(categorized, null).points).toBe(10)
  })

  it("uses customPoints when provided", () => {
    expect(deriveSignalStamp(categorized, 42).points).toBe(42)
  })

  it("preserves an explicit customPoints of 0 (?? not ||)", () => {
    // The whole reason for nullish coalescing: a deliberate 0 must NOT be
    // overwritten by defaultPoints. `0 || 10` would wrongly yield 10.
    expect(deriveSignalStamp(categorized, 0).points).toBe(0)
  })

  it("passes a null intentCategory through unchanged (placeholder codes stay excluded)", () => {
    const s = deriveSignalStamp(placeholder, 7)
    expect(s.intentCategory).toBeNull()
    expect(s.signalLevel).toBe("contact")
    expect(s.points).toBe(7)
  })
})
