/* ── Marketing Module Design Tokens & Constants ── */

export const CARD_BG = "#0F1118"
export const CARD_BORDER = "rgba(255,255,255,0.06)"
export const TEXT_PRIMARY = "#F0F0F2"
export const TEXT_SECONDARY = "rgba(240,240,242,0.55)"
export const TEXT_TERTIARY = "rgba(240,240,242,0.3)"
export const ROSE_GOLD = "#C08B88"
export const GREEN = "#34D399"
export const AMBER = "#FBBF24"
export const INDIGO = "#818CF8"
export const RED = "#F87171"
export const CYAN = "#22D3EE"

/* ── Platform definitions ── */
export const PLATFORMS = [
  { id: "linkedin", label: "LinkedIn", color: "#0A66C2", icon: "in" },
  { id: "twitter", label: "X / Twitter", color: "#1DA1F2", icon: "\uD835\uDD4F" },
  { id: "telegram", label: "Telegram", color: "#26A5E4", icon: "\u2708" },
  { id: "instagram", label: "Instagram", color: "#E1306C", icon: "\uD83D\uDCF7" },
]

export const PLATFORM_COLORS: Record<string, string> = {
  linkedin: "#0A66C2",
  twitter: "#1DA1F2",
  telegram: "#26A5E4",
  instagram: "#E1306C",
  youtube: "#FF0000",
  tiktok: "#000000",
}

/* ── Content idea statuses ── */
export const IDEA_STATUSES = [
  { id: "idea", label: "Ideas", icon: "\uD83D\uDCA1", color: TEXT_TERTIARY },
  { id: "draft", label: "Draft", icon: "\uD83D\uDCDD", color: AMBER },
  { id: "scheduled", label: "Scheduled", icon: "\uD83D\uDCC5", color: "#60A5FA" },
  { id: "published", label: "Published", icon: "\u2705", color: GREEN },
  { id: "rejected", label: "Rejected", icon: "\u274C", color: RED },
]

export const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  idea:      { bg: "rgba(240,240,242,0.06)", text: TEXT_TERTIARY },
  draft:     { bg: "rgba(251,191,36,0.12)", text: AMBER },
  scheduled: { bg: "rgba(96,165,250,0.12)", text: "#60A5FA" },
  published: { bg: "rgba(52,211,153,0.12)", text: GREEN },
  rejected:  { bg: "rgba(248,113,113,0.12)", text: RED },
}

/* ── Content types ── */
export const CONTENT_TYPES = ["post", "thread", "video", "infographic", "story", "article"]

/* ── Priority ── */
export const PRIORITIES = [
  { id: "high", label: "High", color: RED },
  { id: "medium", label: "Medium", color: AMBER },
  { id: "low", label: "Low", color: TEXT_TERTIARY },
]

/* ── Tags ── */
export const CONTENT_TAGS = ["product", "compliance", "brand", "thought_leadership", "announcement", "community", "hiring", "growth"]

/* ── Intel types ── */
export const INTEL_TYPES = [
  { id: "competitor", label: "Competitor", color: RED, bg: "rgba(248,113,113,0.12)" },
  { id: "trend", label: "Trend", color: INDIGO, bg: "rgba(129,140,248,0.12)" },
  { id: "tool", label: "Tool", color: GREEN, bg: "rgba(52,211,153,0.12)" },
  { id: "regulation", label: "Regulation", color: AMBER, bg: "rgba(251,191,36,0.12)" },
  { id: "opportunity", label: "Opportunity", color: ROSE_GOLD, bg: "rgba(192,139,136,0.12)" },
]

export const INTEL_TYPE_COLORS: Record<string, { bg: string; text: string }> = {}
for (const t of INTEL_TYPES) INTEL_TYPE_COLORS[t.id] = { bg: t.bg, text: t.color }

export const RELEVANCE_COLORS: Record<string, { bg: string; text: string }> = {
  high:   { bg: "rgba(248,113,113,0.12)", text: RED },
  medium: { bg: "rgba(251,191,36,0.12)", text: AMBER },
  low:    { bg: "rgba(240,240,242,0.06)", text: TEXT_TERTIARY },
}

/* ── Shared label style ── */
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

/* ── Number formatter ── */
export function fmtNum(val: number): string {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`
  if (val >= 1_000) return `${(val / 1_000).toFixed(1)}K`
  return val.toLocaleString()
}
