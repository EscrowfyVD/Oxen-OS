export function calculateBusinessDays(start: Date, end: Date, halfDay: boolean): number {
  if (halfDay) return 0.5
  let days = 0
  const current = new Date(start)
  current.setHours(0, 0, 0, 0)
  const endDate = new Date(end)
  endDate.setHours(0, 0, 0, 0)
  while (current <= endDate) {
    const dow = current.getDay()
    if (dow !== 0 && dow !== 6) days++
    current.setDate(current.getDate() + 1)
  }
  return days
}

export const formatDate = (d: string | Date) =>
  new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })

export const formatShortDate = (d: string | Date) =>
  new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" })

export const getDaysInMonth = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()

export const getFirstDayOfMonth = (date: Date) => {
  const day = new Date(date.getFullYear(), date.getMonth(), 1).getDay()
  return day === 0 ? 6 : day - 1 // Monday = 0
}

export function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}
