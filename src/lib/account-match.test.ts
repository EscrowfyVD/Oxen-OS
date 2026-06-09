import { describe, it, expect } from "vitest"
import { normalizeCompanyName, matchConfidence } from "./account-match"

describe("normalizeCompanyName", () => {
  it("lowercases, strips punctuation + dotted abbreviations + legal suffixes", () => {
    expect(normalizeCompanyName("Mercury, Inc.")).toBe("mercury")
    expect(normalizeCompanyName("Mercury Technologies")).toBe("mercury technologies")
    expect(normalizeCompanyName("Acme S.A.R.L")).toBe("acme") // dots removed → sarl suffix stripped
    expect(normalizeCompanyName("Foo  Ltd.")).toBe("foo")
    expect(normalizeCompanyName("Gamma S.A.")).toBe("gamma") // S.A. → sa → stripped
    expect(normalizeCompanyName("Beta GmbH")).toBe("beta")
  })

  it("does NOT strip non-entity words (group/holdings) — conservative", () => {
    expect(normalizeCompanyName("ACME GLOBAL HOLDINGS")).toBe("acme global holdings")
    expect(normalizeCompanyName("Acme Group")).toBe("acme group")
  })

  it("returns empty for empty / suffix-only / whitespace inputs", () => {
    expect(normalizeCompanyName("")).toBe("")
    expect(normalizeCompanyName("Ltd")).toBe("")
    expect(normalizeCompanyName("   ")).toBe("")
  })
})

describe("matchConfidence", () => {
  it("exact → 1.0", () => {
    expect(matchConfidence("mercury", "mercury")).toBe(1.0)
  })
  it("whole-word starts-with → 0.9", () => {
    expect(matchConfidence("mercury", "mercury technologies")).toBe(0.9)
  })
  it("substring → 0.7 (below the 0.85 caller cutoff)", () => {
    expect(matchConfidence("acme", "big acme holdings")).toBe(0.7)
  })
  it("partial token is NOT a starts-with (conservative) → 0.7, not 0.9", () => {
    expect(matchConfidence("merc", "mercury technologies")).toBe(0.7)
  })
  it("no overlap → 0", () => {
    expect(matchConfidence("mercury", "acme")).toBe(0)
  })
  it("empty inputs → 0", () => {
    expect(matchConfidence("", "mercury")).toBe(0)
    expect(matchConfidence("mercury", "")).toBe(0)
  })
})
