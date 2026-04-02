/* ── Marketing Module Shared Types ── */

export interface SocialMetric {
  id: string
  platform: string
  date: string
  followers: number
  impressions: number
  engagement: number
  clicks: number
  posts: number
  entity: string
  createdBy: string
  createdAt: string
}

export interface ContentIdea {
  id: string
  title: string
  description: string | null
  platform: string | null
  type: string | null
  status: string
  priority: string
  scheduledFor: string | null
  publishedAt: string | null
  assignedTo: string | null
  tags: string[]
  notes: string | null
  createdBy: string
  createdAt: string
  updatedAt: string
  complianceChecks?: { id: string; status: string; score: number | null }[]
}

export interface MarketingIntel {
  id: string
  type: string
  title: string
  source: string | null
  summary: string
  relevance: string
  tags: string[]
  createdBy: string
  createdAt: string
}

export interface MarketingSummary {
  totalFollowers: number
  monthlyImpressions: number
  engagementRate: number
  contentPipeline: number
  latestByPlatform: Record<string, {
    followers: number
    impressions: number
    engagement: number
    clicks: number
    posts: number
    date: string
  }>
  currentMonthByPlatform: Record<string, {
    impressions: number
    engagement: number
    clicks: number
    posts: number
  }>
  followerGrowth: Record<string, number>
  trendByMonth: Record<string, Record<string, {
    followers: number
    impressions: number
    engagement: number
    posts: number
  }>>
}

export interface Employee {
  id: string
  name: string
  initials: string
  role: string
}
