/* ── CRM v2 — Canonical Configuration ── */

// ─── Primary Verticals (7) ───
export const VERTICALS = [
  "FinTech / Crypto",
  "Family Office",
  "CSP / Fiduciaries",
  "Luxury Assets",
  "iGaming",
  "Yacht Brokers",
  "Import / Export",
] as const
export type Vertical = (typeof VERTICALS)[number]

// ─── Sub-Verticals (28) ───
export const SUB_VERTICALS = [
  "Corporate Lawyers",
  "M&A Lawyers",
  "Tax Lawyers",
  "Immigration Lawyers",
  "International Contracts Lawyers",
  "RBI Specialists",
  "CBI Specialists",
  "Wealth Managers",
  "Trustees / Trust Companies",
  "Corporate Service Providers (CSPs)",
  "Management Companies",
  "Asset Managers",
  "Fund Managers",
  "Crypto Funds",
  "Crypto Accountants",
  "Crypto Tax Advisors",
  "Crypto Company Services Providers",
  "Multi-Family Offices (MFO)",
  "Real Estate Brokers",
  "Yacht Brokers",
  "Art Brokers",
  "Private Jets Brokers",
  "Luxury Concierges",
  "Relocation Agencies",
  "iGaming Operators",
  "iGaming Platform Providers",
  "International Trade Companies",
  "Freight / Logistics Brokers",
  "Commodity Traders",
] as const

// ─── Geo Zones ───
export const GEO_ZONES = [
  "Malta",
  "Cyprus",
  "Luxembourg",
  "UK",
  "UAE",
  "Europe",
  "Asia",
  "South America",
  "Other",
] as const
export type GeoZone = (typeof GEO_ZONES)[number]

// ─── Deal Owner Auto-Assignment ───
export const DEAL_OWNERS = ["Andy", "Paul Louis", "Vernon"] as const
export type DealOwner = (typeof DEAL_OWNERS)[number]

export const GEO_OWNER_MAP: Record<string, DealOwner> = {
  Malta: "Andy",
  Cyprus: "Andy",
  Luxembourg: "Andy",
  Europe: "Andy",
  "South America": "Andy",
  Other: "Andy",
  UK: "Paul Louis",
  UAE: "Vernon",
  Asia: "Vernon",
}

export function getOwnerForGeo(geoZone: string | null | undefined): DealOwner {
  if (!geoZone) return "Andy"
  return GEO_OWNER_MAP[geoZone] ?? "Andy"
}

// ─── Pipeline Stages (9) ───
export const PIPELINE_STAGES = [
  { id: "new_lead",           label: "New Lead",           probability: 0.05, color: "#9CA3AF" },
  { id: "sequence_active",    label: "Sequence Active",    probability: 0.10, color: "#3B82F6" },
  { id: "replied",            label: "Replied",            probability: 0.20, color: "#818CF8" },
  { id: "meeting_booked",     label: "Meeting Booked",     probability: 0.40, color: "#A78BFA" },
  { id: "meeting_completed",  label: "Meeting Completed",  probability: 0.50, color: "#C08B88" },
  { id: "proposal_sent",      label: "Proposal Sent",      probability: 0.60, color: "#FBBF24" },
  { id: "negotiation",        label: "Negotiation",        probability: 0.75, color: "#F97316" },
  { id: "closed_won",         label: "Closed Won",         probability: 1.00, color: "#34D399" },
  { id: "closed_lost",        label: "Closed Lost",        probability: 0.00, color: "#F87171" },
] as const

export type PipelineStage = (typeof PIPELINE_STAGES)[number]["id"]

export const STAGE_PROBABILITY: Record<string, number> = {}
export const STAGE_LABELS: Record<string, string> = {}
export const STAGE_COLORS: Record<string, string> = {}
for (const s of PIPELINE_STAGES) {
  STAGE_PROBABILITY[s.id] = s.probability
  STAGE_LABELS[s.id] = s.label
  STAGE_COLORS[s.id] = s.color
}

// ─── Lifecycle Stages (mirrors pipeline for contacts) ───
export const LIFECYCLE_STAGES = PIPELINE_STAGES.map((s) => s.id)

// ─── Acquisition Sources ───
export const ACQUISITION_SOURCES = [
  "Clay / Outbound Sequence",
  "Conference",
  "Referral / Introducer",
  "Inbound / Website",
  "LinkedIn / Sales Navigator",
  "Partner / Introducer",
  "Calendly / Inbound Booking",
  "Other",
] as const

// ─── Lost Reasons ───
export const LOST_REASONS = [
  "Pricing too high",
  "Chose competitor",
  "Timing not right",
  "Compliance / KYC issues",
  "No response after multiple attempts",
  "Not qualified (wrong ICP)",
  "Internal decision — project cancelled",
  "Already satisfied with current provider",
  "Jurisdiction not supported",
  "Other",
] as const

// ─── KYC Status ───
export const KYC_STATUSES = [
  { id: "not_started",       label: "Not Started",       color: "#9CA3AF" },
  { id: "in_progress",       label: "In Progress",       color: "#F59E0B" },
  { id: "documents_pending", label: "Documents Pending", color: "#F97316" },
  { id: "under_review",      label: "Under Review",      color: "#3B82F6" },
  { id: "approved",          label: "Approved",           color: "#10B981" },
  { id: "rejected",          label: "Rejected",           color: "#EF4444" },
] as const

export const KYC_COLORS: Record<string, string> = {}
for (const k of KYC_STATUSES) KYC_COLORS[k.id] = k.color

// ─── Deal Aging Thresholds ───
export const DEAL_AGING = [
  { days: 30, color: "#EF4444", label: "Stale" },
  { days: 14, color: "#F97316", label: "At Risk" },
  { days: 7,  color: "#F59E0B", label: "Needs Attention" },
] as const

export function getAgingColor(days: number): string {
  if (days >= 30) return "#EF4444"
  if (days >= 14) return "#F97316"
  if (days >= 7) return "#F59E0B"
  return "#34D399"
}

export function getAgingLabel(days: number): string {
  if (days >= 30) return "Stale"
  if (days >= 14) return "At Risk"
  if (days >= 7) return "Needs Attention"
  return "On Track"
}

// ─── Outreach Groups ───
export const OUTREACH_GROUPS = [
  { id: "group_1", label: "GROUP 1 — STRUCTURAL ARCHITECTS", short: "Structural Architects", description: "Fiduciaries, CSPs, Company Formation Agents", color: "#818CF8" },
  { id: "group_2", label: "GROUP 2 — LEGAL DEAL-FLOW", short: "Legal Deal-Flow", description: "Corporate Lawyers, M&A, International Contracts", color: "#C08B88" },
  { id: "group_3", label: "GROUP 3 — INVESTMENT GATEKEEPERS", short: "Investment Gatekeepers", description: "Golden Visa, CBI, RBI Specialists", color: "#34D399" },
  { id: "group_4", label: "GROUP 4 — WEALTH INTERMEDIARIES", short: "Wealth Intermediaries", description: "Multi-Family Offices (MFOs)", color: "#FBBF24" },
  { id: "group_5", label: "GROUP 5 — COMPLIANCE & ACCOUNTING", short: "Compliance & Accounting", description: "Accountants, Tax Lawyers, CFO-as-a-Service", color: "#A78BFA" },
  { id: "group_6", label: "GROUP 6 — HIGH-TICKET SETTLEMENT", short: "High-Ticket Settlement", description: "Luxury Brokers: Yachts, Private Jets, Art, Real Estate", color: "#F87171" },
  { id: "group_7a", label: "GROUP 7A — LIFESTYLE INTERMEDIARIES", short: "Lifestyle Intermediaries", description: "Luxury Concierges", color: "#22D3EE" },
  { id: "group_7b", label: "GROUP 7B — MOBILITY INTERMEDIARIES", short: "Mobility Intermediaries", description: "Relocation Agencies", color: "#60A5FA" },
]

export const OUTREACH_GROUP_COLORS: Record<string, string> = {}
for (const g of OUTREACH_GROUPS) OUTREACH_GROUP_COLORS[g.id] = g.color

// Auto-suggest group based on sub-vertical
export function suggestGroupFromSubVertical(subVertical: string): string | null {
  const lower = subVertical.toLowerCase()
  if (lower.includes("trustee") || lower.includes("fiduciar") || lower.includes("csp") || lower.includes("company formation")) return "group_1"
  if (lower.includes("lawyer") || lower.includes("legal") || lower.includes("m&a") || lower.includes("contract")) return "group_2"
  if (lower.includes("golden visa") || lower.includes("cbi") || lower.includes("rbi") || lower.includes("investment migration")) return "group_3"
  if (lower.includes("family office") || lower.includes("mfo") || lower.includes("multi-family")) return "group_4"
  if (lower.includes("accountant") || lower.includes("tax") || lower.includes("cfo") || lower.includes("audit")) return "group_5"
  if (lower.includes("yacht") || lower.includes("jet") || lower.includes("art deal") || lower.includes("real estate") || lower.includes("luxury")) return "group_6"
  if (lower.includes("concierge")) return "group_7a"
  if (lower.includes("relocation")) return "group_7b"
  return null
}

// ─── Contact Types ───
export const CONTACT_TYPES = ["prospect", "client", "introducer", "partner"] as const
export type ContactType = (typeof CONTACT_TYPES)[number]

// ─── ICP Fit ───
export const ICP_FITS = [
  { id: "tier_1", label: "Tier 1", color: "#34D399", bg: "rgba(52,211,153,0.12)" },
  { id: "tier_2", label: "Tier 2", color: "#FBBF24", bg: "rgba(251,191,36,0.12)" },
  { id: "tier_3", label: "Tier 3", color: "#9CA3AF", bg: "rgba(156,163,175,0.12)" },
] as const

// ─── Relationship Strength ───
export const RELATIONSHIP_STRENGTHS = [
  { id: "strong",          label: "Strong",          color: "#34D399", bg: "rgba(52,211,153,0.12)" },
  { id: "warm",            label: "Warm",            color: "#FBBF24", bg: "rgba(251,191,36,0.12)" },
  { id: "cold",            label: "Cold",            color: "#60A5FA", bg: "rgba(96,165,250,0.12)" },
  { id: "no_relationship", label: "No Relationship", color: "#9CA3AF", bg: "rgba(156,163,175,0.12)" },
] as const

// ─── CRM Task Types ───
export const TASK_TYPES = [
  { id: "follow_up_email",      label: "Follow-up Email" },
  { id: "follow_up_call",       label: "Follow-up Call" },
  { id: "schedule_meeting",     label: "Schedule Meeting" },
  { id: "send_proposal",        label: "Send Proposal" },
  { id: "pre_meeting_prep",     label: "Pre-Meeting Prep" },
  { id: "post_meeting_summary", label: "Post-Meeting Summary" },
  { id: "conference_followup",  label: "Conference Follow-up" },
  { id: "send_documents",       label: "Send Documents" },
  { id: "internal_discussion",  label: "Internal Discussion" },
  { id: "crm_data_update",      label: "CRM Data Update" },
  { id: "other",                label: "Other" },
] as const

// ─── Activity Types with Icons ───
export const ACTIVITY_TYPES = [
  { id: "email_sent",           label: "Email Sent",         icon: "📧" },
  { id: "email_received",       label: "Email Received",     icon: "📨" },
  { id: "meeting_calendly",     label: "Meeting (Calendly)", icon: "📅" },
  { id: "meeting_manual",       label: "Meeting (Manual)",   icon: "📅" },
  { id: "call_outbound",        label: "Outbound Call",      icon: "📞" },
  { id: "call_inbound",         label: "Inbound Call",       icon: "📲" },
  { id: "linkedin_message",     label: "LinkedIn Message",   icon: "💬" },
  { id: "whatsapp_message",     label: "WhatsApp Message",   icon: "📱" },
  { id: "clay_sequence_event",  label: "Clay Sequence",      icon: "🔄" },
  { id: "note_added",           label: "Note Added",         icon: "📝" },
  { id: "file_attached",        label: "File Attached",      icon: "📎" },
  { id: "conference_encounter", label: "Conference Encounter", icon: "🎪" },
  { id: "stage_change",         label: "Stage Changed",      icon: "🏷" },
  { id: "task_completed",       label: "Task Completed",     icon: "✅" },
  { id: "proposal_sent",        label: "Proposal Sent",      icon: "📋" },
] as const

export const ACTIVITY_ICONS: Record<string, string> = {}
for (const a of ACTIVITY_TYPES) ACTIVITY_ICONS[a.id] = a.icon

// ─── Revenue Ranges ───
export const REVENUE_RANGES = ["<100K", "100K-500K", "500K-1M", "1M-5M", "5M-20M", "20M+", "Unknown"] as const

// ─── Deal Owner Colors (for avatars) ───
export const OWNER_COLORS: Record<string, string> = {
  Andy: "#C08B88",
  "Paul Louis": "#818CF8",
  Vernon: "#34D399",
}

// ─── UI Color tokens (CSS-variable-backed for light/dark theme support) ───
export const CRM_COLORS = {
  card_bg: "var(--card-bg)",
  card_border: "var(--card-border)",
  text_primary: "var(--text-primary)",
  text_secondary: "var(--text-secondary)",
  text_tertiary: "var(--text-tertiary)",
  rose_gold: "#C08B88",           // Rose gold stays constant in both themes
  green: "var(--green)",
  amber: "var(--amber)",
  indigo: "var(--indigo)",
  red: "var(--red)",
  cyan: "#22D3EE",
  teal: "#2DD4BF",
  purple: "#A78BFA",
  glass_blur: "blur(var(--glass-blur))",
  glass_shadow: "var(--glass-shadow)",
} as const

// ─── Helper: format currency ───
export function fmtCurrency(val: number, prefix = "€"): string {
  const abs = Math.abs(val)
  const sign = val < 0 ? "-" : ""
  if (abs >= 1_000_000) return `${sign}${prefix}${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${sign}${prefix}${(abs / 1_000).toFixed(0)}K`
  return `${sign}${prefix}${abs.toFixed(0)}`
}

export function fmtCurrencyFull(val: number, prefix = "€"): string {
  const sign = val < 0 ? "-" : ""
  return `${sign}${prefix}${Math.abs(val).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}
