/* ── Support Module Design Tokens & Constants ── */

export const CARD_BG = "rgba(15,17,24,0.6)"
export const CARD_BG_SOLID = "#0F1118"
export const CARD_BORDER = "rgba(255,255,255,0.06)"
export const GLASS_BLUR = "blur(20px)"
export const GLASS_SHADOW = "0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.03)"
export const TEXT_PRIMARY = "#F0F0F2"
export const TEXT_SECONDARY = "rgba(240,240,242,0.55)"
export const TEXT_TERTIARY = "rgba(240,240,242,0.3)"
export const ROSE_GOLD = "#C08B88"
export const GREEN = "#34D399"
export const AMBER = "#FBBF24"
export const RED = "#F87171"
export const BLUE = "#60A5FA"
export const PURPLE = "#A78BFA"
export const INDIGO = "#818CF8"
export const CYAN = "#22D3EE"

/* ── Channel definitions ── */
export const CHANNELS = [
  { id: "telegram", label: "Telegram", color: "#26A5E4", icon: "\u2708" },
  { id: "email", label: "Email", color: "#818CF8", icon: "\u2709" },
  { id: "whatsapp", label: "WhatsApp", color: "#25D366", icon: "\uD83D\uDCAC" },
  { id: "phone", label: "Phone", color: AMBER, icon: "\uD83D\uDCDE" },
  { id: "live_chat", label: "Live Chat", color: CYAN, icon: "\uD83D\uDCAD" },
]

export const CHANNEL_COLORS: Record<string, string> = {}
for (const c of CHANNELS) CHANNEL_COLORS[c.id] = c.color

/* ── Status definitions ── */
export const STATUSES = [
  { id: "open", label: "Open", color: BLUE },
  { id: "in_progress", label: "In Progress", color: AMBER },
  { id: "waiting_client", label: "Waiting Client", color: PURPLE },
  { id: "resolved", label: "Resolved", color: GREEN },
  { id: "closed", label: "Closed", color: TEXT_TERTIARY },
]

export const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  open: { bg: "rgba(96,165,250,0.12)", text: BLUE },
  in_progress: { bg: "rgba(251,191,36,0.12)", text: AMBER },
  waiting_client: { bg: "rgba(167,139,250,0.12)", text: PURPLE },
  resolved: { bg: "rgba(52,211,153,0.12)", text: GREEN },
  closed: { bg: "rgba(240,240,242,0.06)", text: TEXT_TERTIARY },
}

/* ── Priority definitions ── */
export const PRIORITIES = [
  { id: "urgent", label: "Urgent", color: RED },
  { id: "high", label: "High", color: AMBER },
  { id: "medium", label: "Medium", color: TEXT_SECONDARY },
  { id: "low", label: "Low", color: TEXT_TERTIARY },
]

export const PRIORITY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  urgent: { bg: "rgba(248,113,113,0.08)", text: RED, border: RED },
  high: { bg: "rgba(251,191,36,0.08)", text: AMBER, border: AMBER },
  medium: { bg: "transparent", text: TEXT_SECONDARY, border: "transparent" },
  low: { bg: "transparent", text: TEXT_TERTIARY, border: "transparent" },
}

/* ── Category definitions ── */
export const CATEGORIES = [
  { id: "account_issue", label: "Account Issue" },
  { id: "transaction", label: "Transaction" },
  { id: "onboarding", label: "Onboarding" },
  { id: "compliance", label: "Compliance" },
  { id: "technical", label: "Technical" },
  { id: "general", label: "General" },
]

export const CATEGORY_LABELS: Record<string, string> = {}
for (const c of CATEGORIES) CATEGORY_LABELS[c.id] = c.label

/* ── Helpers ── */
export function fmtDuration(ms: number): string {
  if (ms <= 0) return "—"
  const mins = Math.floor(ms / 60000)
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ${mins % 60}m`
  const days = Math.floor(hrs / 24)
  return `${days}d ${hrs % 24}h`
}

export function fmtDurationShort(ms: number): string {
  if (ms <= 0) return "—"
  const mins = Math.floor(ms / 60000)
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  return `${days}d`
}

export function fmtDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
}

export function fmtDateTime(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
}

export function timeAgo(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

/* ── Shared styles ── */
export const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 10,
  color: TEXT_TERTIARY,
  textTransform: "uppercase",
  letterSpacing: 1,
  marginBottom: 6,
  fontFamily: "'DM Sans', sans-serif",
  fontWeight: 500,
}

export const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  borderRadius: 8,
  border: `1px solid ${CARD_BORDER}`,
  background: "rgba(255,255,255,0.02)",
  color: TEXT_PRIMARY,
  fontSize: 12,
  fontFamily: "'DM Sans', sans-serif",
  outline: "none",
}
