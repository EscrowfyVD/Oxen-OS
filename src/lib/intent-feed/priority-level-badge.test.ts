/**
 * Tests for priorityLevelBadgeProps (Sprint 3d B4 Option C).
 *
 * The SignalCard component renders the badge only when this helper
 * returns non-null, so the test surface here covers both the
 * "render" and "don't render" branches without firing up a React
 * test renderer (this codebase has no @testing-library/react).
 */

import { describe, it, expect } from "vitest"
import { priorityLevelBadgeProps } from "./priority-level-badge"

describe("priorityLevelBadgeProps", () => {
  // ─── [1] P1 renders with rose-gold ─────────────────────────────
  it("[1] P1 returns the rose-gold badge", () => {
    expect(priorityLevelBadgeProps("P1")).toEqual({
      color: "#C08B88",
      opacity: 0.18,
      label: "P1",
    })
  })

  // ─── [2] P2 renders with amber ─────────────────────────────────
  it("[2] P2 returns the amber badge", () => {
    expect(priorityLevelBadgeProps("P2")).toEqual({
      color: "#FBBF24",
      opacity: 0.15,
      label: "P2",
    })
  })

  // ─── [3] P3 + Monitor each have their own colour ───────────────
  it("[3] P3 and Monitor map to distinct gray/indigo badges", () => {
    expect(priorityLevelBadgeProps("P3")?.color).toBe("#9CA3AF")
    expect(priorityLevelBadgeProps("Monitor")?.color).toBe("#3B82F6")
    expect(priorityLevelBadgeProps("Monitor")?.label).toBe("Monitor")
  })

  // ─── [4] null / Excluded / unknown → no badge ──────────────────
  it("[4] null, Excluded, and unknown values render no badge", () => {
    expect(priorityLevelBadgeProps(null)).toBeNull()
    expect(priorityLevelBadgeProps(undefined)).toBeNull()
    expect(priorityLevelBadgeProps("Excluded")).toBeNull()
    expect(priorityLevelBadgeProps("FutureLevel")).toBeNull()
    expect(priorityLevelBadgeProps("")).toBeNull()
  })
})
