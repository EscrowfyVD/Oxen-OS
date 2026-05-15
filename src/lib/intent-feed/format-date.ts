// Date formatting helpers for the Intent Feed UI.
//
// The repo intentionally avoids date-fns / dayjs (zero deps for a
// single-format need). All formatting goes through Intl.DateTimeFormat
// with the same en-GB locale used elsewhere (telegram.ts brief
// formatter, calendar exports).

const SIGNAL_DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
})

/**
 * Format an IntentSignal occurredAt / createdAt for display in the
 * feed: "14 May 14:32". Compact (fits in a card header) and consistent
 * with the en-GB locale used across the OS.
 *
 * Intl.DateTimeFormat en-GB injects a literal "," between the date
 * and time parts ("14 May, 14:32"). We strip it so the rendered card
 * matches the spec exactly. Replace is locale-safe — only the literal
 * separator changes across runtimes.
 *
 * Accepts a Date or a parseable string (ISO from API JSON). Returns
 * an empty string for invalid input rather than throwing — the card
 * still renders, just without the timestamp.
 */
export function formatSignalDate(date: Date | string | null | undefined): string {
  if (!date) return ""
  const d = typeof date === "string" ? new Date(date) : date
  if (Number.isNaN(d.getTime())) return ""
  return SIGNAL_DATE_FORMATTER.format(d).replace(",", "")
}
