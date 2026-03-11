/* ── CRM Shared Types ── */

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
  createdBy: string
  createdAt: string
  updatedAt: string
  interactions: Interaction[]
}

export interface Interaction {
  id: string
  contactId: string
  type: string
  content: string
  createdBy: string
  createdAt: string
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
