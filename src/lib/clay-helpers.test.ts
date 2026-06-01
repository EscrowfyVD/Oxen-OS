// Tests for client-safe pure helpers (Sprint S0 batch 4 hotfix split).
// These functions don't touch Prisma — pure unit tests, no mocks needed.

import { describe, it, expect } from "vitest"
import {
  classifyPersona,
  extractClayTableSegment,
  extractCountryFromLocation,
  parseClayTableName,
} from "./clay-helpers"

// ─────────────────────────────────────────────────────────────────────
describe("classifyPersona", () => {
  // DM keywords (D1): ceo, founder, owner, managing director, chief,
  //                   president, partner, director
  it("classifies CEO as DM", () => {
    expect(classifyPersona("CEO")).toBe("DM")
  })
  it("classifies Chief Executive Officer as DM", () => {
    expect(classifyPersona("Chief Executive Officer")).toBe("DM")
  })
  it("classifies Managing Director as DM", () => {
    expect(classifyPersona("Managing Director")).toBe("DM")
  })
  it("classifies plain Director as DM", () => {
    expect(classifyPersona("Director")).toBe("DM")
  })
  it("classifies Partner as DM", () => {
    expect(classifyPersona("Partner")).toBe("DM")
  })
  it("classifies VP Finance as OP (no DM keyword)", () => {
    expect(classifyPersona("VP Finance")).toBe("OP")
  })
  it("classifies Software Engineer as OP", () => {
    expect(classifyPersona("Software Engineer")).toBe("OP")
  })
  it("classifies Account Manager as OP", () => {
    expect(classifyPersona("Account Manager")).toBe("OP")
  })
  it("returns null for empty string", () => {
    expect(classifyPersona("")).toBeNull()
  })
  it("returns null for null input", () => {
    expect(classifyPersona(null)).toBeNull()
  })
  it("returns null for undefined input", () => {
    expect(classifyPersona(undefined)).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────
describe("extractClayTableSegment", () => {
  it("extracts segment from a Company table name", () => {
    expect(
      extractClayTableSegment("vDC_G1_Tier 1_Company_Active Business Loss"),
    ).toBe("Active Business Loss")
  })
  it("extracts segment from a People table name", () => {
    expect(
      extractClayTableSegment("vDC_G2_Tier 2_People_Crypto Funds Series A"),
    ).toBe("Crypto Funds Series A")
  })
  it("returns null when segment is empty", () => {
    // Trailing underscore with no content after — regex .+ requires ≥ 1 char
    expect(extractClayTableSegment("vDC_G1_Tier 1_Company_")).toBeNull()
  })
  it("returns null when table name does not match the pattern", () => {
    expect(extractClayTableSegment("invalid_table_name")).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────
describe("parseClayTableName", () => {
  it("parses a Company table name into all 4 fields", () => {
    expect(
      parseClayTableName("vDC_G1_Tier 1_Company_Active Business Loss"),
    ).toEqual({
      scope: "company",
      group: "G1",
      painTier: "T1",
      segment: "Active Business Loss",
    })
  })

  it("parses a People table name with a kept group (G6) + T2", () => {
    expect(
      parseClayTableName("vDC_G6_Tier 2_People_Crypto Funds Series A"),
    ).toEqual({
      scope: "people",
      group: "G6",
      painTier: "T2",
      segment: "Crypto Funds Series A",
    })
  })

  it("does NOT resolve a retired group (G7B) — closeout #4 dropped G7A/G7B", () => {
    // The regex still matches the token, but G7B is no longer in VALID_GROUPS,
    // so `group` stays null while the rest of the name still parses.
    const parsed = parseClayTableName(
      "vDC_G7B_Tier 2_People_Crypto Funds Series A",
    )
    expect(parsed.group).toBeNull()
    expect(parsed.scope).toBe("people")
    expect(parsed.painTier).toBe("T2")
    expect(parsed.segment).toBe("Crypto Funds Series A")
  })

  it("returns nulls for malformed table name", () => {
    expect(parseClayTableName("garbage_table_name")).toEqual({
      scope: null,
      group: null,
      painTier: null,
      segment: null,
    })
  })

  it("partial parse: missing tier", () => {
    const r = parseClayTableName("vDC_G3_Company_Some Segment")
    expect(r.scope).toBe("company")
    expect(r.group).toBe("G3")
    expect(r.painTier).toBeNull()
    expect(r.segment).toBe("Some Segment")
  })

  it("rejects invalid group token (G99 not in enum)", () => {
    const r = parseClayTableName("vDC_G99_Tier 1_Company_X")
    expect(r.group).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────
// Sprint S0 batch 4 hotfix v3 — Country extraction from location
describe("extractCountryFromLocation", () => {
  // Happy path — PRD-001 in-scope geographies
  it("extracts United Arab Emirates from 'Dubai, United Arab Emirates'", () => {
    expect(extractCountryFromLocation("Dubai, United Arab Emirates")).toBe(
      "United Arab Emirates",
    )
  })
  it("extracts Cyprus from 'Larnaca, Cyprus'", () => {
    expect(extractCountryFromLocation("Larnaca, Cyprus")).toBe("Cyprus")
  })
  it("extracts Malta from 'Sliema, Malta'", () => {
    expect(extractCountryFromLocation("Sliema, Malta")).toBe("Malta")
  })
  it("extracts France from 'Paris, France'", () => {
    expect(extractCountryFromLocation("Paris, France")).toBe("France")
  })

  // Negative cases
  it("returns null for single-token location 'London' (no comma)", () => {
    expect(extractCountryFromLocation("London")).toBeNull()
  })
  it("returns null for empty string", () => {
    expect(extractCountryFromLocation("")).toBeNull()
  })
  it("returns null for null input", () => {
    expect(extractCountryFromLocation(null)).toBeNull()
  })
  it("returns null for undefined input", () => {
    expect(extractCountryFromLocation(undefined)).toBeNull()
  })
  it("returns null for unknown country (whitelist miss)", () => {
    expect(
      extractCountryFromLocation("Some City, Unknown Country"),
    ).toBeNull()
  })

  // Multi-segment & normalization
  it("takes the LAST segment for 'City, Region, Country'", () => {
    expect(extractCountryFromLocation("Dubai, Dubai Emirate, France")).toBe(
      "France",
    )
  })
  it("normalizes 'UAE' → 'United Arab Emirates'", () => {
    expect(extractCountryFromLocation("Dubai, UAE")).toBe(
      "United Arab Emirates",
    )
  })
  it("normalizes 'UK' → 'United Kingdom'", () => {
    expect(extractCountryFromLocation("London, UK")).toBe("United Kingdom")
  })
  it("normalizes 'USA' → 'United States'", () => {
    expect(extractCountryFromLocation("New York, USA")).toBe("United States")
  })
  it("normalizes 'United States of America' → 'United States'", () => {
    expect(
      extractCountryFromLocation("New York, United States of America"),
    ).toBe("United States")
  })
  it("matches case-insensitively ('cyprus' lowercase)", () => {
    expect(extractCountryFromLocation("Limassol, cyprus")).toBe("Cyprus")
  })
  it("trims whitespace around segments ('Dubai , United Arab Emirates ')", () => {
    expect(
      extractCountryFromLocation("Dubai , United Arab Emirates "),
    ).toBe("United Arab Emirates")
  })
})
