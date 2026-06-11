import { describe, it, expect } from "vitest"
import { matchesIndustryKeyword, APIFY_INDUSTRY_KEYWORDS } from "./apify-keywords"

describe("matchesIndustryKeyword", () => {
  it("matches a single-word keyword on a whole token (case-insensitive)", () => {
    expect(matchesIndustryKeyword("A promising fintech startup")).toBe(true)
    expect(matchesIndustryKeyword("FINTECH platform")).toBe(true)
    expect(matchesIndustryKeyword("crypto custody provider")).toBe(true)
  })

  it("matches a multi-word phrase as a substring", () => {
    expect(matchesIndustryKeyword("We run a single family office in Geneva")).toBe(true)
    expect(matchesIndustryKeyword("Hiring a Head of KYC")).toBe(true)
  })

  it("does NOT false-positive on a substring inside another word", () => {
    // "aml" is a keyword, but must not match inside "scramble"/"camla".
    expect(matchesIndustryKeyword("the eggs scramble nicely")).toBe(false)
    // "trust" is a keyword, but must not match inside "trusted".
    expect(matchesIndustryKeyword("a trusted local bakery")).toBe(false)
  })

  it("returns false for irrelevant text and empty input", () => {
    expect(matchesIndustryKeyword("artisan sourdough bakery hiring a barista")).toBe(false)
    expect(matchesIndustryKeyword("")).toBe(false)
  })

  it("the keyword list is non-empty and lowercase", () => {
    expect(APIFY_INDUSTRY_KEYWORDS.length).toBeGreaterThan(0)
    for (const kw of APIFY_INDUSTRY_KEYWORDS) {
      expect(kw).toBe(kw.toLowerCase())
    }
  })
})
