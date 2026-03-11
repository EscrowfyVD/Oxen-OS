/* ── Support Module Shared Types ── */

export interface SupportTicket {
  id: string
  subject: string
  clientName: string
  clientEmail: string | null
  channel: string
  status: string
  priority: string
  category: string | null
  assignedTo: string | null
  contactId: string | null
  contact: {
    id: string
    name: string
    email: string | null
    company: string | null
  } | null
  messages: SupportMessage[]
  resolvedAt: string | null
  firstResponseAt: string | null
  createdBy: string
  createdAt: string
  updatedAt: string
  _count?: { messages: number }
}

export interface SupportMessage {
  id: string
  ticketId: string
  sender: string
  content: string
  isInternal: boolean
  createdAt: string
}

export interface SupportStats {
  total: number
  openCount: number
  resolvedToday: number
  avgResponseMs: number
  avgResolutionMs: number
  resolutionRate: number
  byChannel: Record<string, number>
  byCategory: Record<string, number>
  byStatus: Record<string, number>
  agentStats: Record<string, {
    assigned: number
    resolved: number
    avgResponseMs: number
    avgResolutionMs: number
  }>
  agentDailyResolved: Record<string, number[]>
  recentActivity: {
    id: string
    subject: string
    status: string
    category: string | null
    assignedTo: string | null
    updatedAt: string
  }[]
}

export interface DailyStats {
  date: string
  opened: number
  resolved: number
  avgResponseMs: number
  byStatus: Record<string, number>
  byAgent: Record<string, number>
}

export interface Employee {
  id: string
  name: string
  initials: string
  role: string
}
