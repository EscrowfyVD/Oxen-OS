/* ── CRO Revenue Intelligence Design Tokens & Constants ── */

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
export const CYAN = "#22D3EE"
export const TEAL = "#2DD4BF"

/* ── Pipeline columns (contact-level CRM) ── */
export const PIPELINE_COLUMNS = [
  { id: "lead", label: "Lead", accent: TEXT_SECONDARY },
  { id: "qualified", label: "Qualified", accent: INDIGO },
  { id: "proposal", label: "Proposal", accent: AMBER },
  { id: "negotiation", label: "Negotiation", accent: ROSE_GOLD },
  { id: "won", label: "Won", accent: GREEN },
]

/* ── Deal stages (CRO bowtie model) ── */
export const DEAL_STAGES = [
  { id: "discovery", label: "Discovery", accent: TEXT_SECONDARY },
  { id: "demo", label: "Demo", accent: INDIGO },
  { id: "proposal", label: "Proposal", accent: AMBER },
  { id: "negotiation", label: "Negotiation", accent: ROSE_GOLD },
  { id: "commit", label: "Commit", accent: GREEN },
  { id: "integration", label: "Integration", accent: CYAN },
  { id: "volume_ramp", label: "Volume Ramp", accent: TEAL },
]

/* ── Health statuses ── */
export const HEALTH_STATUSES = [
  { id: "healthy", label: "Healthy", color: GREEN, bg: "rgba(52,211,153,0.12)" },
  { id: "watch", label: "Watch", color: AMBER, bg: "rgba(251,191,36,0.12)" },
  { id: "at_risk", label: "At Risk", color: RED, bg: "rgba(248,113,113,0.12)" },
  { id: "declining", label: "Declining", color: ROSE_GOLD, bg: "rgba(192,139,136,0.12)" },
  { id: "churned", label: "Churned", color: TEXT_TERTIARY, bg: "rgba(240,240,242,0.06)" },
]

export const HEALTH_COLORS: Record<string, { bg: string; text: string }> = {
  healthy:   { bg: "rgba(52,211,153,0.12)", text: GREEN },
  watch:     { bg: "rgba(251,191,36,0.12)", text: AMBER },
  at_risk:   { bg: "rgba(248,113,113,0.12)", text: RED },
  declining: { bg: "rgba(192,139,136,0.12)", text: ROSE_GOLD },
  churned:   { bg: "rgba(240,240,242,0.06)", text: TEXT_TERTIARY },
}

/* ── Segments ── */
export const SEGMENTS = ["Enterprise", "Mid-Market", "SMB"]

/* ── Forecast buckets ── */
export const FORECAST_BUCKETS = [
  { id: "committed", label: "Committed", threshold: 80, color: GREEN, bg: "rgba(52,211,153,0.08)" },
  { id: "probable", label: "Best Case", threshold: 50, color: AMBER, bg: "rgba(251,191,36,0.08)" },
  { id: "stretch", label: "Upside", threshold: 0, color: INDIGO, bg: "rgba(129,140,248,0.08)" },
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

/* ── Deal stage colors ── */
export const STAGE_COLORS: Record<string, { bg: string; text: string }> = {
  discovery:    { bg: "rgba(240,240,242,0.06)", text: TEXT_SECONDARY },
  demo:         { bg: "rgba(129,140,248,0.12)", text: INDIGO },
  proposal:     { bg: "rgba(251,191,36,0.12)", text: AMBER },
  negotiation:  { bg: "rgba(192,139,136,0.12)", text: ROSE_GOLD },
  commit:       { bg: "rgba(52,211,153,0.12)", text: GREEN },
  integration:  { bg: "rgba(34,211,238,0.12)", text: CYAN },
  volume_ramp:  { bg: "rgba(45,212,191,0.12)", text: TEAL },
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

/* ── Chart colors (for Recharts) ── */
export const CHART_COLORS = {
  gtv: ROSE_GOLD,
  revenue: GREEN,
  primary: ROSE_GOLD,
  secondary: INDIGO,
  grid: "rgba(255,255,255,0.04)",
  axis: TEXT_TERTIARY,
  tooltip: CARD_BG,
}
