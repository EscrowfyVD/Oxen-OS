/**
 * Pure helper — pick the visual badge props for a CrmContact.priorityLevel.
 *
 * Sprint 3d Option C (B4). The SignalCard component renders a small
 * pill in its header showing the parent contact's priority level. By
 * extracting the per-level styling decision into a pure function, we
 * can unit-test the mapping without firing up a React test renderer
 * (this codebase has no @testing-library/react).
 *
 * Returns `null` for cases where the badge should NOT render:
 *   - `null` priorityLevel (contact never scored — pre-Sprint 3c data)
 *   - `"Excluded"` (operators don't want excluded clutter in the feed;
 *     the signal is still visible if it slipped past the cron, but the
 *     badge would imply the contact deserves attention, which is wrong)
 *   - any other unknown string (defensive — future levels won't render
 *     with a random color until this map is updated)
 *
 * Color tokens match the CRM design system intent — rose-gold for P1
 * (the CRM accent, "act now"), amber for P2, gray for P3 (de-emphasised
 * but visible), indigo for Monitor (informational, not urgent).
 *
 * Refs:
 *   - Sprint 3d recon Finding 14
 *   - src/lib/crm-config.ts (CRM_COLORS palette)
 *   - prisma/schema.prisma:402 (CrmContact.priorityLevel)
 */

export interface PriorityLevelBadgeProps {
  /** Hex color string (no alpha — caller composes the background fill). */
  color: string
  /** Background alpha for the pill fill, matches SignalCard badgeStyle(). */
  opacity: number
  /** Uppercase display text inside the pill. */
  label: string
}

export function priorityLevelBadgeProps(
  level: string | null | undefined,
): PriorityLevelBadgeProps | null {
  switch (level) {
    case "P1":
      return { color: "#C08B88", opacity: 0.18, label: "P1" } // rose-gold accent
    case "P2":
      return { color: "#FBBF24", opacity: 0.15, label: "P2" } // amber
    case "P3":
      return { color: "#9CA3AF", opacity: 0.15, label: "P3" } // gray
    case "Monitor":
      return { color: "#3B82F6", opacity: 0.15, label: "Monitor" } // indigo
    default:
      // null, undefined, "Excluded", or unknown → no badge.
      return null
  }
}
