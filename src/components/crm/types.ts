/* ── CRM v2 — Shared Types ── */

export interface Contact {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string | null
  linkedinUrl: string | null
  jobTitle: string | null
  companyId: string | null
  company: { id: string; name: string; domain: string | null } | null
  // Classification
  vertical: string[]
  subVertical: string[]
  geoZone: string | null
  dealOwner: string | null
  acquisitionSource: string | null
  acquisitionSourceDetail: string | null
  lifecycleStage: string
  icpFit: string | null
  contactType: string
  // Clay enrichment
  companySize: string | null
  fundingStage: string | null
  techStack: string[]
  annualRevenueRange: string | null
  country: string | null
  city: string | null
  // Smart fields
  lastInteraction: string | null
  daysSinceLastContact: number | null
  nextScheduledMeeting: string | null
  totalInteractions: number
  avgResponseTimeHours: number | null
  relationshipStrength: string | null
  relationshipScore: number
  aiSummary: string | null
  // Meta
  doNotContact: boolean
  pinnedNote: string | null
  createdBy: string | null
  // Introducer
  introducerId: string | null
  introducer: { id: string; firstName: string; lastName: string } | null
  introducerVertical: string[]
  introducerGeo: string | null
  totalReferrals: number
  successfulReferrals: number
  referralSuccessRate: number | null
  // Legacy compat
  telegram: string | null
  whatsapp: string | null
  website: string | null
  // Relations (optional, populated with includes)
  deals: Deal[]
  activities: Activity[]
  intentSignals?: IntentSignal[]
  emails?: Array<{ id: string; subject: string; snippet: string | null; from: string; to: string[]; date: string; direction: string; bodyText: string | null }>
  // Timestamps
  createdAt: string
  updatedAt: string
}

export interface Deal {
  id: string
  dealName: string
  contactId: string
  contact?: {
    id: string
    firstName: string
    lastName: string
    company: { id: string; name: string } | null
  }
  companyId: string | null
  company?: { id: string; name: string } | null
  stage: string
  dealValue: number | null
  dealOwner: string
  acquisitionSource: string | null
  acquisitionSourceDetail: string | null
  vertical: string[]
  expectedCloseDate: string | null
  winProbability: number | null
  weightedValue: number | null
  lostReason: string | null
  lostNotes: string | null
  kycStatus: string
  daysInCurrentStage: number
  daysSinceLastActivity: number
  aiDealHealth: string | null
  introducerId: string | null
  conferenceName: string | null
  stageChangedAt: string
  closedAt: string | null
  notes: string | null
  createdBy: string
  createdAt: string
  updatedAt: string
  activities?: Activity[]
  tasks?: CrmTask[]
}

export interface Activity {
  id: string
  type: string
  description: string | null
  contactId: string | null
  dealId: string | null
  metadata: Record<string, unknown> | null
  performedBy: string
  createdAt: string
}

export interface CrmTask {
  id: string
  title: string
  description: string | null
  type: string
  dueDate: string | null
  completed: boolean
  completedAt: string | null
  assignedTo: string
  contactId: string | null
  dealId: string | null
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface Employee {
  id: string
  name: string
  initials: string
  role: string
}

export interface IntentSignal {
  id: string
  contactId: string
  source: string
  signalType: string
  title: string
  detail: string | null
  score: number
  expiresAt: string | null
  createdAt: string
}

/* ── Dashboard / Report Types ── */

export interface PipelineData {
  totalDeals: number
  totalDealValue: number
  totalWeightedValue: number
  avgProbability: number
  byStage: Array<{
    stage: string
    count: number
    dealValue: number
    weightedValue: number
  }>
  deals: Deal[]
  wonThisQuarter: number
  lostThisQuarter: number
}

export interface ForecastData {
  currentMonthlyRevenue: number
  committed: ForecastBucket
  probable: ForecastBucket
  stretch: ForecastBucket
  projections: Array<{
    month: string
    base: number
    committed: number
    probable: number
    stretch: number
    total: number
  }>
}

export interface ForecastBucket {
  count: number
  totalDealValue: number
  weightedValue: number
  deals: Deal[]
}
