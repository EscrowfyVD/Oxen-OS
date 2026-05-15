// Shared types for the Intent Feed page + its inline components.
// Mirrors the IntentFeedSignal shape returned by GET /api/intent-feed
// (see src/lib/intent-feed/format-signal.ts). Re-exported here so the
// page + its components don't reach into the lib directly — keeps the
// UI free to evolve its prop shapes without dragging the API contract.

export interface SignalContact {
  id: string
  name: string
  email: string
  jobTitle: string | null
  linkedinUrl: string | null
  group: string | null
  painTier: string | null
  persona: string | null
}

export interface SignalCompany {
  id: string
  name: string
  country: string | null
}

export interface IntentFeedSignalView {
  id: string
  source: string
  signalTypeCode: string
  signalTypeLabel: string
  category: string
  title: string
  detail: string | null
  points: number
  proxyScore: number
  isHot: boolean
  createdAt: string
  expiresAt: string | null
  sourceUrl: string | null
  actionedAt: string | null
  actionedBy: string | null
  contact: SignalContact | null
  company: SignalCompany | null
  metadata: Record<string, unknown> | null
}

export interface SignalTypeOption {
  code: string
  label: string
  category: string
  defaultPoints: number
}
