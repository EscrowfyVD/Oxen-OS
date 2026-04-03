/* ── Support Module Configuration ── */

export const SLA_TIMES: Record<string, { responseMinutes: number; resolutionMinutes: number; label: string }> = {
  urgent:  { responseMinutes: 60,   resolutionMinutes: 240,  label: "1 hour" },
  high:    { responseMinutes: 240,  resolutionMinutes: 480,  label: "4 hours" },
  medium:  { responseMinutes: 1440, resolutionMinutes: 2880, label: "24 hours" },
  low:     { responseMinutes: 2880, resolutionMinutes: 5760, label: "48 hours" },
}

export const SUPPORT_AGENTS = ["Christel", "Tsiaro"] as const

export function getNextAgent(lastAssigned?: string | null): string {
  if (!lastAssigned || lastAssigned === SUPPORT_AGENTS[SUPPORT_AGENTS.length - 1]) {
    return SUPPORT_AGENTS[0]
  }
  const idx = SUPPORT_AGENTS.indexOf(lastAssigned as any)
  return SUPPORT_AGENTS[(idx + 1) % SUPPORT_AGENTS.length]
}

export function detectPriority(subject: string, dealValue?: number | null): string {
  const lower = subject.toLowerCase()
  if (lower.includes("urgent") || lower.includes("asap") || lower.includes("critical") || lower.includes("emergency")) {
    return "urgent"
  }
  if (dealValue && dealValue >= 50000) return "high"
  return "medium"
}

export function getSlaLabel(priority: string): string {
  return SLA_TIMES[priority]?.label ?? "24 hours"
}

export const SUPPORT_COLORS: Record<string, string> = {
  open: "#3B82F6",
  in_progress: "#F59E0B",
  waiting_client: "#8B5CF6",
  resolved: "#10B981",
  closed: "#6B7280",
  urgent: "#EF4444",
  high: "#F97316",
  medium: "#FBBF24",
  low: "#6B7280",
}
