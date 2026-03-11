/* ── CRO Revenue Intelligence Shared Types ── */

export interface Contact {
  id: string
  name: string
  email: string | null
  phone: string | null
  company: string | null
  sector: string | null
  status: string
  source: string | null
  value: number | null
  currency: string
  notes: string | null
  assignedTo: string | null
  telegram: string | null
  whatsapp: string | null
  website: string | null
  country: string | null
  // CRO fields
  healthStatus: string
  monthlyGtv: number | null
  monthlyRevenue: number | null
  takeRate: number | null
  segment: string | null
  projectedVolume: number | null
  createdBy: string
  createdAt: string
  updatedAt: string
  interactions: Interaction[]
  metrics?: CustomerMetrics[]
  deals?: Deal[]
}

export interface Interaction {
  id: string
  contactId: string
  type: string
  content: string
  createdBy: string
  createdAt: string
}

export interface CustomerMetrics {
  id: string
  contactId: string
  month: string
  gtv: number
  revenue: number
  takeRate: number
  txCount: number
}

export interface Deal {
  id: string
  name: string
  contactId: string
  contact?: {
    id: string
    name: string
    company: string | null
    sector: string | null
    segment: string | null
  }
  stage: string
  expectedVolume: number | null
  takeRate: number | null
  expectedRevenue: number | null
  probability: number
  closeDate: string | null
  assignedTo: string | null
  notes: string | null
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

export interface ContactFormData {
  name: string
  email: string
  phone: string
  company: string
  sector: string
  status: string
  source: string
  value: string
  currency: string
  assignedTo: string
  country: string
  telegram: string
  whatsapp: string
  website: string
  notes: string
  healthStatus: string
  monthlyGtv: string
  monthlyRevenue: string
  takeRate: string
  segment: string
  projectedVolume: string
}

export interface DealFormData {
  name: string
  contactId: string
  stage: string
  expectedVolume: string
  takeRate: string
  expectedRevenue: string
  probability: string
  closeDate: string
  assignedTo: string
  notes: string
}

/* ── CRO Dashboard Types ── */

export interface OverviewData {
  monthlyGtv: number
  monthlyRevenue: number
  avgTakeRate: number
  revenueRunRate: number
  activeCustomers: number
  totalContacts: number
  pipelineValue: number
  revenueTrend: Array<{ month: string; gtv: number; revenue: number }>
  concentration: {
    top1Pct: number
    top2to5Pct: number
    top6to10Pct: number
    restPct: number
  }
  topCustomers: Array<{
    id: string
    name: string
    company: string | null
    monthlyGtv: number | null
    monthlyRevenue: number | null
    takeRate: number | null
    healthStatus: string
    segment: string | null
  }>
  alerts: Array<{
    id: string
    name: string
    company: string | null
    healthStatus: string
    monthlyGtv: number | null
    monthlyRevenue: number | null
    segment: string | null
  }>
  healthDistribution: Array<{ status: string; count: number }>
}

export interface PipelineData {
  totalDeals: number
  totalExpectedRevenue: number
  totalWeightedRevenue: number
  avgProbability: number
  byStage: Array<{
    stage: string
    count: number
    expectedRevenue: number
    weightedRevenue: number
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
  totalRevenue: number
  weightedRevenue: number
  totalVolume: number
  deals: Deal[]
}

export interface MetricsData {
  monthly: Array<{
    month: string
    gtv: number
    revenue: number
    takeRate: number
    txCount: number
    customerCount: number
    gtvGrowth: number
    revenueGrowth: number
  }>
}

export interface CrmStats {
  totalContacts: number
  pipelineValue: number
  wonDeals: number
  wonValue: number
  conversionRate: number
  byStatus: Array<{ status: string; count: number; value: number }>
  bySector: Array<{ sector: string; count: number }>
  monthlyNew: Array<{ month: string; count: number }>
  topDeals: Contact[]
}
