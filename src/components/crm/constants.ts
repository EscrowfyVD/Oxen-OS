/* ── CRM Design Tokens & Constants ── */

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
export const PURPLE = "#A78BFA"
export const FROST = "#FFFFFF"

/* ── Pipeline columns ── */
export const PIPELINE_COLUMNS = [
  { id: "lead", label: "Lead", accent: TEXT_SECONDARY },
  { id: "qualified", label: "Qualified", accent: INDIGO },
  { id: "proposal", label: "Proposal", accent: AMBER },
  { id: "negotiation", label: "Negotiation", accent: ROSE_GOLD },
  { id: "won", label: "Won", accent: GREEN },
]

/* ── Dropdown options ── */
export const SECTORS = ["iGaming", "Crypto", "Family Office", "Luxury", "Fintech", "Other"]
export const STATUSES = ["lead", "qualified", "proposal", "negotiation", "won", "lost"]
export const SOURCES = ["SiGMA", "Referral", "Inbound", "LinkedIn", "Cold Outreach", "Other"]
export const INTERACTION_TYPES = ["call", "email", "meeting", "note", "whatsapp", "telegram"]

/* ── Sector colors ── */
export const SECTOR_COLORS: Record<string, { bg: string; text: string }> = {
  iGaming:          { bg: "rgba(192,139,136,0.12)", text: ROSE_GOLD },
  Crypto:           { bg: "rgba(52,211,153,0.12)", text: GREEN },
  "Family Office":  { bg: "rgba(129,140,248,0.12)", text: INDIGO },
  Luxury:           { bg: "rgba(251,191,36,0.12)", text: AMBER },
  Fintech:          { bg: "rgba(167,139,250,0.12)", text: PURPLE },
  Other:            { bg: "rgba(255,255,255,0.06)", text: TEXT_SECONDARY },
}

/* ── Status colors ── */
export const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  lead:         { bg: "rgba(240,240,242,0.06)", text: TEXT_SECONDARY },
  qualified:    { bg: "rgba(129,140,248,0.12)", text: INDIGO },
  proposal:     { bg: "rgba(251,191,36,0.12)", text: AMBER },
  negotiation:  { bg: "rgba(192,139,136,0.12)", text: ROSE_GOLD },
  won:          { bg: "rgba(52,211,153,0.12)", text: GREEN },
  lost:         { bg: "rgba(248,113,113,0.12)", text: RED },
}

/* ── Interaction type icons ── */
export const INTERACTION_ICONS: Record<string, string> = {
  call: "📞",
  email: "✉",
  meeting: "🤝",
  note: "📝",
  whatsapp: "💬",
  telegram: "✈",
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
