/* ── AI Module Design Tokens & Constants ── */

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

/* ── Insight type colors ── */
export const INSIGHT_TYPES = [
  { id: "opportunity", label: "Opportunity", color: GREEN, bg: "rgba(52,211,153,0.08)" },
  { id: "risk", label: "Risk", color: RED, bg: "rgba(248,113,113,0.08)" },
  { id: "buying_signal", label: "Buying Signal", color: ROSE_GOLD, bg: "rgba(192,139,136,0.08)" },
  { id: "churn_warning", label: "Churn Warning", color: AMBER, bg: "rgba(251,191,36,0.08)" },
  { id: "upsell", label: "Upsell", color: INDIGO, bg: "rgba(129,140,248,0.08)" },
  { id: "news_alert", label: "News Alert", color: BLUE, bg: "rgba(96,165,250,0.08)" },
  { id: "follow_up_needed", label: "Follow-Up", color: PURPLE, bg: "rgba(167,139,250,0.08)" },
  { id: "deal_stuck", label: "Deal Stuck", color: AMBER, bg: "rgba(251,191,36,0.08)" },
]

export const INSIGHT_TYPE_COLORS: Record<string, { color: string; bg: string }> = {}
for (const t of INSIGHT_TYPES) INSIGHT_TYPE_COLORS[t.id] = { color: t.color, bg: t.bg }

export const SEVERITY_COLORS: Record<string, { dot: string; text: string }> = {
  critical: { dot: RED, text: RED },
  high: { dot: RED, text: RED },
  medium: { dot: AMBER, text: AMBER },
  low: { dot: TEXT_TERTIARY, text: TEXT_TERTIARY },
}

/* ── Quick action chips ── */
export const QUICK_ACTIONS = [
  { label: "Prepare next meeting", prompt: "Sentinel, prepare a brief for my next upcoming meeting." },
  { label: "Show at-risk clients", prompt: "Sentinel, which clients are at risk of churning or need immediate attention?" },
  { label: "Weekly digest", prompt: "Sentinel, give me a weekly digest of pipeline activity, key meetings, and action items." },
  { label: "Research a company", prompt: "Sentinel, research " },
]

/* ── Brief sections ── */
export const BRIEF_SECTIONS = [
  { key: "company_context", label: "Company Context", icon: "\uD83D\uDCCA" },
  { key: "relationship_history", label: "Relationship History", icon: "\uD83E\uDD1D" },
  { key: "deal_status", label: "Deal Status", icon: "\uD83D\uDCC8" },
  { key: "recent_news", label: "Recent News", icon: "\uD83D\uDCF0" },
  { key: "talking_points", label: "Talking Points", icon: "\uD83D\uDCAC" },
  { key: "risks", label: "Risks", icon: "\u26A0\uFE0F" },
  { key: "opportunities", label: "Opportunities", icon: "\uD83C\uDFAF" },
  { key: "suggested_ask", label: "Suggested Ask", icon: "\uD83D\uDCCB" },
]

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

export function fmtDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  })
}
