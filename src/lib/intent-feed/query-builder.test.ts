/**
 * Tests for buildIntentFeedWhere — focuses on the Sprint 3d B4
 * priorityLevel branch and its merge with the pre-existing group
 * filter. Both filters target the same `where.contact` relation
 * object; the test guards against a regression where one overwrites
 * the other (the bug they'd cause: "filtering by P1 silently drops
 * the group constraint").
 */

import { describe, it, expect } from "vitest"
import { buildIntentFeedWhere } from "./query-builder"

describe("buildIntentFeedWhere — priorityLevel (Sprint 3d)", () => {
  // ─── [5a] priorityLevel alone ─────────────────────────────────
  it("[5a] applies priorityLevel via where.contact", () => {
    const where = buildIntentFeedWhere({ priorityLevel: "P1" })
    expect(where.contact).toEqual({ priorityLevel: "P1" })
  })

  // ─── [5b] group + priorityLevel merge ─────────────────────────
  it("[5b] merges group + priorityLevel into a single contact filter", () => {
    const where = buildIntentFeedWhere({ group: "G1", priorityLevel: "P1" })
    expect(where.contact).toEqual({ group: "G1", priorityLevel: "P1" })
  })

  // ─── [5c] no priority filter → no contact constraint ───────────
  it("[5c] absent priorityLevel does not add a contact filter", () => {
    const where = buildIntentFeedWhere({ source: "trigify" })
    expect(where.contact).toBeUndefined()
  })
})
