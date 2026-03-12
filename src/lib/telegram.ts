import { prisma } from "@/lib/prisma"

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ""
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`

// ─── Low-level send ─────────────────────────────────────

export async function sendTelegramMessage(
  chatId: string | number,
  text: string,
  parseMode: "Markdown" | "HTML" = "Markdown",
) {
  const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: parseMode }),
  })
  return res.json()
}

// ─── High-level: send notification to an employee ───────

export async function sendTelegramNotification(
  employeeId: string,
  message: string,
): Promise<boolean> {
  try {
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { telegramChatId: true, name: true },
    })
    if (!employee?.telegramChatId) return false

    const result = await sendTelegramMessage(employee.telegramChatId, message)
    return result.ok === true
  } catch (error) {
    console.error("Telegram notification error:", error)
    return false
  }
}

// ─── Notify by email (lookup employee) ──────────────────

export async function sendTelegramNotificationByEmail(
  email: string,
  message: string,
): Promise<boolean> {
  try {
    const employee = await prisma.employee.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { telegramChatId: true },
    })
    if (!employee?.telegramChatId) return false

    const result = await sendTelegramMessage(employee.telegramChatId, message)
    return result.ok === true
  } catch {
    return false
  }
}

// ─── Format meeting brief for Telegram ──────────────────

export function formatBriefForTelegram(brief: {
  title: string
  meetingDate: Date | string
  attendees: string[]
  briefContent: Record<string, unknown>
}): string {
  const bc = brief.briefContent
  const date = new Date(brief.meetingDate)
  const dateStr = date.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
  const timeStr = date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  })

  const parts: string[] = []

  parts.push(`🏛 *Meeting Brief — Oxen OS*`)
  parts.push(``)
  parts.push(`📅 *${escapeMd(brief.title)}*`)
  parts.push(`${escapeMd(dateStr)} · ${timeStr}`)
  parts.push(`👥 ${escapeMd(brief.attendees.join(", ") || "Not specified")}`)

  if (bc.company_context) {
    parts.push(``)
    parts.push(`📊 *Company Context*`)
    parts.push(escapeMd(String(bc.company_context)))
  }

  if (bc.relationship_history) {
    parts.push(``)
    parts.push(`🤝 *Relationship History*`)
    parts.push(escapeMd(String(bc.relationship_history)))
  }

  if (bc.deal_status) {
    parts.push(``)
    parts.push(`💰 *Deal Status*`)
    parts.push(escapeMd(String(bc.deal_status)))
  }

  if (bc.talking_points && Array.isArray(bc.talking_points)) {
    parts.push(``)
    parts.push(`💬 *Talking Points*`)
    for (const tp of bc.talking_points as string[]) {
      parts.push(`• ${escapeMd(tp)}`)
    }
  }

  if (bc.risks && Array.isArray(bc.risks)) {
    parts.push(``)
    parts.push(`⚠️ *Risks*`)
    for (const r of bc.risks as string[]) {
      parts.push(`• ${escapeMd(r)}`)
    }
  }

  if (bc.opportunities && Array.isArray(bc.opportunities)) {
    parts.push(``)
    parts.push(`🎯 *Opportunities*`)
    for (const o of bc.opportunities as string[]) {
      parts.push(`• ${escapeMd(o)}`)
    }
  }

  if (bc.suggested_ask) {
    parts.push(``)
    parts.push(`📋 *Suggested Ask*`)
    parts.push(escapeMd(String(bc.suggested_ask)))
  }

  return parts.join("\n")
}

// ─── Escape markdown special chars for Telegram ─────────

function escapeMd(text: string): string {
  // Telegram Markdown v1: escape _ * ` [
  return text.replace(/([_`\[])/g, "\\$1")
}

// ─── Set webhook URL ────────────────────────────────────

export async function setWebhook(url: string) {
  const res = await fetch(`${TELEGRAM_API}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  })
  return res.json()
}
