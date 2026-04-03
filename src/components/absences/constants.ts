export const CARD_BG = "rgba(15,17,24,0.6)"
export const CARD_BG_SOLID = "#0F1118"
export const CARD_BORDER = "rgba(255,255,255,0.06)"
export const GLASS_BLUR = "blur(20px)"
export const GLASS_SHADOW = "0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.03)"
export const TEXT_PRIMARY = "#E8E6E3"
export const TEXT_SECONDARY = "rgba(232,230,227,0.7)"
export const TEXT_TERTIARY = "rgba(232,230,227,0.4)"
export const FROST = "#F5F0EB"
export const GREEN = "#4ade80"
export const RED = "#f87171"
export const AMBER = "#fbbf24"
export const INDIGO = "#818cf8"
export const ROSE_GOLD = "#C08B88"

export const LEAVE_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  vacation: { bg: "rgba(74,222,128,0.12)", text: GREEN, dot: GREEN },
  sick: { bg: "rgba(248,113,113,0.12)", text: RED, dot: RED },
  ooo: { bg: "rgba(129,140,248,0.12)", text: INDIGO, dot: INDIGO },
}

export const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: "rgba(251,191,36,0.12)", text: AMBER },
  approved: { bg: "rgba(74,222,128,0.12)", text: GREEN },
  rejected: { bg: "rgba(248,113,113,0.12)", text: RED },
}

export const LEAVE_LABELS: Record<string, string> = {
  vacation: "Vacation",
  sick: "Sick Leave",
  ooo: "Out of Office",
}
