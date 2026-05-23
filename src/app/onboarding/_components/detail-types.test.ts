import { describe, it, expect } from "vitest"
import { splitProvenance } from "./detail-types"

describe("splitProvenance", () => {
  it("splits real fields from _source_ provenance tags", () => {
    const out = splitProvenance({
      first_name: "John",
      _source_first_name: "user",
      last_name: "Doe",
      _source_last_name: "operator-provided",
    })
    expect(out.fields).toEqual([
      ["first_name", "John"],
      ["last_name", "Doe"],
    ])
    expect(out.provenanceFor("first_name")).toBe("user")
    expect(out.provenanceFor("last_name")).toBe("operator-provided")
  })

  it("returns null for fields with no _source_ tag (defensive)", () => {
    const out = splitProvenance({
      first_name: "John",
    })
    expect(out.fields).toEqual([["first_name", "John"]])
    expect(out.provenanceFor("first_name")).toBeNull()
  })

  it("returns null for unknown field keys", () => {
    const out = splitProvenance({ first_name: "John", _source_first_name: "user" })
    expect(out.provenanceFor("missing_field")).toBeNull()
  })

  it("ignores _source_ entries whose value is not a string", () => {
    const out = splitProvenance({
      first_name: "John",
      _source_first_name: 42 as unknown as string, // simulate upstream drift
    })
    expect(out.provenanceFor("first_name")).toBeNull()
  })
})
