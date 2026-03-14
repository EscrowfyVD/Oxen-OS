// Shared avatar theme definitions and utilities

export const AVATAR_THEMES: Record<string, { gradient: string; bg: string; border: string }> = {
  rose:    { gradient: "linear-gradient(135deg, #C08B88, #8B6B68)", bg: "rgba(192,139,136,0.12)", border: "rgba(192,139,136,0.3)" },
  blue:    { gradient: "linear-gradient(135deg, #6B8BC0, #4A6B9A)", bg: "rgba(107,139,192,0.12)", border: "rgba(107,139,192,0.3)" },
  green:   { gradient: "linear-gradient(135deg, #7BAF7B, #5A8F5A)", bg: "rgba(123,175,123,0.12)", border: "rgba(123,175,123,0.3)" },
  purple:  { gradient: "linear-gradient(135deg, #9B7BC0, #7A5AA0)", bg: "rgba(155,123,192,0.12)", border: "rgba(155,123,192,0.3)" },
  amber:   { gradient: "linear-gradient(135deg, #C0A86B, #A08B4A)", bg: "rgba(192,168,107,0.12)", border: "rgba(192,168,107,0.3)" },
  teal:    { gradient: "linear-gradient(135deg, #6BC0B8, #4AA09A)", bg: "rgba(107,192,184,0.12)", border: "rgba(107,192,184,0.3)" },
  indigo:  { gradient: "linear-gradient(135deg, #7B7BC0, #5A5AA0)", bg: "rgba(123,123,192,0.12)", border: "rgba(123,123,192,0.3)" },
  orange:  { gradient: "linear-gradient(135deg, #C09B6B, #A07B4A)", bg: "rgba(192,155,107,0.12)", border: "rgba(192,155,107,0.3)" },
}

export const AVATAR_THEME_NAMES = Object.keys(AVATAR_THEMES)

/** Returns gradient string for an avatarColor value. Handles both theme names and legacy rgba values. */
export function getAvatarGradient(avatarColor: string | null | undefined): string {
  if (!avatarColor) return AVATAR_THEMES.rose.gradient
  const theme = AVATAR_THEMES[avatarColor]
  if (theme) return theme.gradient
  // Legacy rgba/gradient values — return as-is
  if (avatarColor.startsWith("rgba") || avatarColor.startsWith("linear-gradient") || avatarColor.startsWith("#")) {
    return avatarColor
  }
  return AVATAR_THEMES.rose.gradient
}

/** Returns the least-used theme name from existing employee colors. */
export function getLeastUsedTheme(existingColors: string[]): string {
  const counts: Record<string, number> = {}
  for (const name of AVATAR_THEME_NAMES) counts[name] = 0
  for (const color of existingColors) {
    if (color in counts) counts[color]++
  }
  let min = Infinity
  let pick = AVATAR_THEME_NAMES[0]
  for (const name of AVATAR_THEME_NAMES) {
    if (counts[name] < min) {
      min = counts[name]
      pick = name
    }
  }
  return pick
}
