/* ── AI Module Shared Types ── */

export interface ChatMessage {
  role: "user" | "assistant"
  content: string
  timestamp: string
}

export interface AIInsight {
  id: string
  type: string
  title: string
  summary: string
  contactId: string | null
  contact: { id: string; name: string; company: string | null } | null
  severity: string
  actionable: boolean
  dismissed: boolean
  actionTaken: string | null
  linkedTaskId: string | null
  createdAt: string
}

export interface MeetingBrief {
  id: string
  eventId: string | null
  contactId: string | null
  contact: { id: string; name: string; company: string | null } | null
  title: string
  meetingDate: string
  attendees: string[]
  briefContent: {
    company_context?: string
    relationship_history?: string
    deal_status?: string
    recent_news?: string
    talking_points?: string[]
    risks?: string[]
    opportunities?: string[]
    suggested_ask?: string
  }
  status: string
  sentVia: string | null
  createdBy: string
  createdAt: string
}

export interface CompanyIntel {
  id: string
  contactId: string
  companyName: string
  website: string | null
  description: string | null
  industry: string | null
  employeeCount: string | null
  revenue: string | null
  headquarters: string | null
  keyPeople: Array<{ name: string; title: string; linkedin?: string; email?: string }> | null
  recentNews: Array<{ title: string; source: string; date: string; summary: string; sentiment: string }> | null
  ownership: { type?: string; details?: string } | null
  creditRating: string | null
  lastResearched: string | null
  dataSource: string | null
  createdAt: string
  updatedAt: string
}

export interface ActionBlock {
  action: string
  data: Record<string, unknown>
}

export interface CalendarEvent {
  id: string
  title: string
  start: string
  end: string
  attendees: string[]
}
