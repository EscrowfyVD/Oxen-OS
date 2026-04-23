import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendTelegramMessage, formatBriefForTelegram } from "@/lib/telegram"
import { requireWebhookSecret } from "@/lib/webhook-auth"
import { logger, serializeError } from "@/lib/logger"
import Anthropic from "@anthropic-ai/sdk"

const anthropic = new Anthropic()
const tgLog = logger.child({ component: "telegram-webhook" })

// ─── Telegram types ────────────────────────────────────

interface TelegramUpdate {
  update_id: number
  message?: {
    message_id: number
    from: { id: number; first_name: string; last_name?: string; username?: string }
    chat: { id: number; type: string }
    text?: string
    date: number
  }
  callback_query?: {
    id: string
    from: { id: number; first_name: string; username?: string }
    message?: { chat: { id: number } }
    data?: string
  }
}

// In-memory state for pending note-linking (per chatId)
const pendingNotes = new Map<
  number,
  { summary: string; actionItems: string[]; dealUpdates: string[]; rawNote: string }
>()

// ─── Escape HTML for Telegram messages ─────────────────

function esc(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

// ═══════════════════════════════════════════════════════
//  WEBHOOK HANDLER
// ═══════════════════════════════════════════════════════

export async function POST(request: Request) {
  const authError = requireWebhookSecret(request, {
    envVarName: "TELEGRAM_WEBHOOK_SECRET",
    headerName: "x-telegram-bot-api-secret-token",
  })
  if (authError) return authError

  try {
    const update: TelegramUpdate = await request.json()

    // ─── Log every incoming update ───
    const msg = update.message
    const cbq = update.callback_query

    if (msg) {
      tgLog.info({ fromName: msg.from.first_name, username: msg.from.username ?? null, chatId: msg.chat.id, text: msg.text ?? null }, "telegram IN: message")
    } else if (cbq) {
      tgLog.info({ fromName: cbq.from.first_name, data: cbq.data ?? null }, "telegram IN: callback_query")
    } else {
      tgLog.info({ update: JSON.stringify(update).slice(0, 200) }, "telegram IN: update with no message or callback_query")
      return NextResponse.json({ ok: true })
    }

    // ─── Handle callback queries ───
    if (cbq) {
      const cbChatId = cbq.message?.chat.id
      if (cbChatId && cbq.data) {
        await handleCallbackQuery(cbChatId, cbq.data, cbq.id)
      }
      return NextResponse.json({ ok: true })
    }

    // ─── Handle messages ───
    if (!msg?.text) return NextResponse.json({ ok: true })

    const chatId = msg.chat.id
    const text = msg.text.trim()
    const fromName = [msg.from.first_name, msg.from.last_name].filter(Boolean).join(" ")

    // ─── Route commands ───
    if (text.startsWith("/start")) {
      await handleStart(chatId)
    } else if (text.startsWith("/myid")) {
      await handleMyId(chatId)
    } else if (text.startsWith("/brief")) {
      await handleBrief(chatId)
    } else if (text.startsWith("/digest")) {
      await handleDigest(chatId)
    } else if (text.startsWith("/support")) {
      await handleSupport(chatId, text, fromName)
    } else if (text.startsWith("/pipeline")) {
      await handlePipeline(chatId)
    } else if (text.startsWith("/tasks")) {
      await handleTasks(chatId)
    } else if (text.startsWith("/")) {
      // Unknown command
      await sendTelegramMessage(
        chatId,
        "Unknown command. Available:\n/start — Link account\n/myid — Your chat ID\n/brief — Meeting brief\n/digest — Daily digest\n/pipeline — Pipeline summary\n/tasks — Today's tasks\n/support [msg] — Create ticket",
      )
    } else if (pendingNotes.has(chatId)) {
      // User is replying with a contact name to link their note
      await handleNoteLinking(chatId, text)
    } else {
      // Regular text message
      await handleRegularMessage(chatId, text, fromName)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    tgLog.error({ err: serializeError(error) }, "telegram webhook: handler error")
    return NextResponse.json({ ok: true }) // Always 200 so Telegram doesn't retry
  }
}

// Also support GET for webhook verification
export async function GET() {
  return NextResponse.json({ status: "Telegram webhook active" })
}

// ═══════════════════════════════════════════════════════
//  /start — Registration flow
// ═══════════════════════════════════════════════════════

async function handleStart(chatId: number) {
  // Check if already linked
  const existing = await prisma.employee.findFirst({
    where: { telegramChatId: String(chatId) },
    select: { name: true },
  })

  if (existing) {
    await sendTelegramMessage(
      chatId,
      `Welcome back, <b>${esc(existing.name)}</b>! Your account is already linked.\n\n` +
      `<b>Commands:</b>\n` +
      `/brief — Next meeting brief\n` +
      `/digest — Daily digest\n` +
      `/pipeline — Pipeline summary\n` +
      `/tasks — Today's tasks\n` +
      `/support [msg] — Create support ticket\n` +
      `/myid — Your chat ID`,
    )
    return
  }

  await sendTelegramMessage(
    chatId,
    `Welcome to Oxen OS Bot 🏛\n\n` +
    `I'm your assistant for notifications, meeting briefs, and quick CRM actions.\n\n` +
    `Send me your @oxen.finance email to link your account.`,
  )
}

// ═══════════════════════════════════════════════════════
//  /myid — Show chat ID
// ═══════════════════════════════════════════════════════

async function handleMyId(chatId: number) {
  await sendTelegramMessage(chatId, `Your Telegram Chat ID: <code>${chatId}</code>`)
}

// ═══════════════════════════════════════════════════════
//  /brief — Next upcoming meeting brief
// ═══════════════════════════════════════════════════════

async function handleBrief(chatId: number) {
  const employee = await findEmployeeByChatId(chatId)
  if (!employee) {
    await sendTelegramMessage(chatId, "❌ Your account is not linked. Send /start to set up.")
    return
  }

  try {
    // Find next upcoming meeting for this employee
    const now = new Date()

    // 1. Check existing briefs first
    const briefs = await prisma.meetingBrief.findMany({
      where: { meetingDate: { gte: now } },
      orderBy: { meetingDate: "asc" },
      take: 10,
    })

    const myBrief = briefs.find((b) =>
      b.attendees.some(
        (a) =>
          a.toLowerCase().includes(employee.email?.toLowerCase() || "___") ||
          a.toLowerCase().includes(employee.name.toLowerCase()),
      ),
    )

    if (myBrief) {
      const formatted = formatBriefForTelegram({
        title: myBrief.title,
        meetingDate: myBrief.meetingDate,
        attendees: myBrief.attendees,
        briefContent: myBrief.briefContent as Record<string, unknown>,
      })
      await sendTelegramMessage(chatId, formatted)
      return
    }

    // 2. No brief exists — check for upcoming calendar events
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    let nextEvent = null
    try {
      const events = await prisma.calendarEvent.findMany({
        where: {
          startTime: { gte: now, lte: tomorrow },
          attendees: { hasSome: [employee.email || "___"] },
        },
        orderBy: { startTime: "asc" },
        take: 1,
      })
      nextEvent = events[0] || null
    } catch {
      // Calendar may not be available
    }

    if (!nextEvent) {
      // Fallback: search all events for attendee name match
      try {
        const allEvents = await prisma.calendarEvent.findMany({
          where: { startTime: { gte: now, lte: tomorrow } },
          orderBy: { startTime: "asc" },
          take: 20,
        })
        nextEvent = allEvents.find((e) =>
          e.attendees.some(
            (a) =>
              a.toLowerCase().includes(employee.email?.toLowerCase() || "___") ||
              a.toLowerCase().includes(employee.name.toLowerCase()),
          ),
        ) || null
      } catch {
        // silently ignore
      }
    }

    if (!nextEvent) {
      await sendTelegramMessage(chatId, "📭 No upcoming meetings found in the next 24 hours.")
      return
    }

    // 3. Generate brief on-the-fly
    await sendTelegramMessage(chatId, "⏳ Generating brief for your next meeting...", "")

    try {
      const res = await fetch(
        `${process.env.NEXTAUTH_URL || "https://os.oxen.finance"}/api/telegram/check-upcoming`,
        { method: "POST" },
      )
      if (res.ok) {
        // Re-check for the brief that was just generated
        const newBrief = await prisma.meetingBrief.findFirst({
          where: {
            OR: [
              { eventId: nextEvent.googleEventId },
              { title: nextEvent.title, meetingDate: { gte: new Date(nextEvent.startTime.getTime() - 60000), lte: new Date(nextEvent.startTime.getTime() + 60000) } },
            ],
          },
        })

        if (newBrief) {
          const formatted = formatBriefForTelegram({
            title: newBrief.title,
            meetingDate: newBrief.meetingDate,
            attendees: newBrief.attendees,
            briefContent: newBrief.briefContent as Record<string, unknown>,
          })
          await sendTelegramMessage(chatId, formatted)
          return
        }
      }
    } catch {
      // Generation attempt failed
    }

    // 4. Ultimate fallback — basic meeting info
    const timeStr = new Date(nextEvent.startTime).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    await sendTelegramMessage(
      chatId,
      `📅 <b>Next Meeting</b>\n\n` +
      `<b>${nextEvent.title}</b>\n` +
      `🕐 ${timeStr}\n` +
      `👥 ${nextEvent.attendees.join(", ")}\n\n` +
      `<i>Could not generate a full brief. Check the CRM for context.</i>`,
    )
  } catch (error) {
    tgLog.error({ err: serializeError(error), command: "/brief" }, "telegram command failed")
    await sendTelegramMessage(chatId, "❌ Failed to fetch meeting brief. Try again later.")
  }
}

// ═══════════════════════════════════════════════════════
//  /digest — Daily digest via Claude
// ═══════════════════════════════════════════════════════

async function handleDigest(chatId: number) {
  const employee = await findEmployeeByChatId(chatId)
  if (!employee) {
    await sendTelegramMessage(chatId, "❌ Your account is not linked. Send /start to set up.")
    return
  }

  await sendTelegramMessage(chatId, "⏳ Generating your daily digest...", "")

  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const contextParts: string[] = []

    // Today's meetings
    try {
      const meetings = await prisma.calendarEvent.findMany({
        where: { startTime: { gte: today, lt: tomorrow } },
        orderBy: { startTime: "asc" },
      })
      if (meetings.length > 0) {
        contextParts.push("## Today's Meetings")
        for (const m of meetings) {
          contextParts.push(
            `- ${new Date(m.startTime).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} — ${m.title} (${m.attendees.join(", ") || "no attendees"})`,
          )
        }
      }
    } catch {
      /* calendar table may not exist */
    }

    // This user's tasks
    const tasks = await prisma.task.findMany({
      where: {
        column: { not: "done" },
        OR: [
          { assignee: { contains: employee.name, mode: "insensitive" } },
          { assignee: { contains: employee.email || "___", mode: "insensitive" } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 15,
    })
    if (tasks.length > 0) {
      contextParts.push("\n## Your Open Tasks")
      for (const t of tasks) {
        const overdue = t.deadline && new Date(t.deadline) < new Date() ? " ⚠️ OVERDUE" : ""
        contextParts.push(`- [${t.priority}] ${t.title} — ${t.column}${overdue}`)
      }
    }

    // Deals owned by this employee
    const deals = await prisma.deal.findMany({
      where: {
        stage: { notIn: ["closed_won", "closed_lost"] },
        dealOwner: { contains: employee.name, mode: "insensitive" },
      },
      include: {
        contact: {
          select: { firstName: true, lastName: true, company: { select: { name: true } } },
        },
      },
      orderBy: { dealValue: "desc" },
      take: 10,
    })
    if (deals.length > 0) {
      contextParts.push("\n## Your Active Pipeline")
      let totalValue = 0
      for (const d of deals) {
        totalValue += d.dealValue || 0
        const company = d.contact?.company?.name || `${d.contact?.firstName || ""} ${d.contact?.lastName || ""}`.trim() || "?"
        contextParts.push(`- ${d.dealName} (${company}) — ${d.stage} — €${d.dealValue?.toLocaleString() || "?"}`)
      }
      contextParts.push(`Total pipeline: €${totalValue.toLocaleString()}`)
    }

    const prompt = `Generate a concise daily digest for ${employee.name} at Oxen Finance. Today is ${today.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}.

${contextParts.join("\n")}

Format as plain text (no markdown, no HTML) with:
1. Priority Actions — Top 3 things to focus on
2. Today's Meetings — Brief on each
3. Pipeline Pulse — Key deals to watch
4. Quick Stats

Keep it under 2000 characters. Be concise and actionable.`

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    })

    const digest = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")

    await sendTelegramMessage(
      chatId,
      `🏛 <b>Daily Digest — Oxen OS</b>\n\n${esc(digest)}`,
    )
  } catch (error) {
    tgLog.error({ err: serializeError(error), command: "/digest" }, "telegram command failed")
    await sendTelegramMessage(chatId, "❌ Failed to generate digest. Try again later.")
  }
}

// ═══════════════════════════════════════════════════════
//  /support [message] — Create support ticket
// ═══════════════════════════════════════════════════════

async function handleSupport(chatId: number, text: string, fromName: string) {
  const description = text.replace(/^\/support\s*/i, "").trim()

  if (!description) {
    await sendTelegramMessage(
      chatId,
      "Usage: /support [describe your issue]\n\nExample: /support I need help with my account setup",
    )
    return
  }

  try {
    const employee = await prisma.employee.findFirst({
      where: { telegramChatId: String(chatId) },
      select: { name: true, email: true },
    })

    const { createAutoTicket } = await import("@/lib/support-auto")
    const result = await createAutoTicket({
      subject: description.length > 100 ? description.substring(0, 100) + "..." : description,
      clientName: employee?.name || fromName || `Telegram User ${chatId}`,
      clientEmail: employee?.email || null,
      channel: "telegram",
      message: description,
      source: "telegram",
    })

    const ticketRef = result.ticket.id.slice(-8).toUpperCase()
    await sendTelegramMessage(
      chatId,
      `✅ Support ticket created!\n\n` +
      `📋 Reference: #${ticketRef}\n` +
      `📌 Priority: ${result.ticket.priority}\n` +
      `👤 Assigned to: ${result.ticket.assignedTo || "Unassigned"}\n` +
      `⏱ Expected response: ${result.slaLabel}\n\n` +
      `Our team will follow up shortly.`,
    )
  } catch (error) {
    tgLog.error({ err: serializeError(error), command: "/support" }, "telegram command failed")
    await sendTelegramMessage(chatId, "❌ Failed to create support ticket. Try again later.")
  }
}

// ═══════════════════════════════════════════════════════
//  /pipeline — Quick pipeline summary
// ═══════════════════════════════════════════════════════

async function handlePipeline(chatId: number) {
  const employee = await findEmployeeByChatId(chatId)
  if (!employee) {
    await sendTelegramMessage(chatId, "❌ Your account is not linked. Send /start to set up.")
    return
  }

  try {
    // Get all deals owned by this employee
    const deals = await prisma.deal.findMany({
      where: {
        dealOwner: { contains: employee.name, mode: "insensitive" },
        stage: { notIn: ["closed_won", "closed_lost"] },
      },
      select: { stage: true, dealValue: true },
    })

    if (deals.length === 0) {
      await sendTelegramMessage(chatId, "📊 You have no active deals in the pipeline.")
      return
    }

    // Count and sum by stage
    const STAGE_LABELS: Record<string, string> = {
      new_lead: "New Lead",
      sequence_active: "Sequence Active",
      replied: "Replied",
      meeting_booked: "Meeting Booked",
      meeting_completed: "Meeting Completed",
      proposal_sent: "Proposal Sent",
      negotiation: "Negotiation",
    }

    const stageOrder = [
      "new_lead", "sequence_active", "replied",
      "meeting_booked", "meeting_completed",
      "proposal_sent", "negotiation",
    ]

    const stageCounts: Record<string, { count: number; value: number }> = {}
    let totalValue = 0

    for (const deal of deals) {
      if (!stageCounts[deal.stage]) stageCounts[deal.stage] = { count: 0, value: 0 }
      stageCounts[deal.stage].count++
      stageCounts[deal.stage].value += deal.dealValue || 0
      totalValue += deal.dealValue || 0
    }

    let reply = `📊 <b>Your Pipeline</b>\n\n`

    for (const stageId of stageOrder) {
      const data = stageCounts[stageId]
      if (data) {
        const label = STAGE_LABELS[stageId] || stageId
        const valueStr = data.value > 0 ? ` (€${data.value.toLocaleString()})` : ""
        reply += `• ${label}: <b>${data.count}</b>${valueStr}\n`
      }
    }

    reply += `\n<b>Total: ${deals.length} deals — €${totalValue.toLocaleString()}</b>`

    // Also get closed this month
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)

    const wonThisMonth = await prisma.deal.count({
      where: {
        dealOwner: { contains: employee.name, mode: "insensitive" },
        stage: "closed_won",
        closedAt: { gte: monthStart },
      },
    })
    const lostThisMonth = await prisma.deal.count({
      where: {
        dealOwner: { contains: employee.name, mode: "insensitive" },
        stage: "closed_lost",
        closedAt: { gte: monthStart },
      },
    })

    if (wonThisMonth > 0 || lostThisMonth > 0) {
      reply += `\n\n<b>This month:</b> ✅ ${wonThisMonth} won · ❌ ${lostThisMonth} lost`
    }

    await sendTelegramMessage(chatId, reply)
  } catch (error) {
    tgLog.error({ err: serializeError(error), command: "/pipeline" }, "telegram command failed")
    await sendTelegramMessage(chatId, "❌ Failed to fetch pipeline. Try again later.")
  }
}

// ═══════════════════════════════════════════════════════
//  /tasks — Today's tasks
// ═══════════════════════════════════════════════════════

async function handleTasks(chatId: number) {
  const employee = await findEmployeeByChatId(chatId)
  if (!employee) {
    await sendTelegramMessage(chatId, "❌ Your account is not linked. Send /start to set up.")
    return
  }

  try {
    const now = new Date()
    const todayEnd = new Date()
    todayEnd.setHours(23, 59, 59, 999)

    // Get tasks assigned to this user that are not done
    const allTasks = await prisma.task.findMany({
      where: {
        column: { not: "done" },
        OR: [
          { assignee: { contains: employee.name, mode: "insensitive" } },
          { assignee: { contains: employee.email || "___", mode: "insensitive" } },
        ],
      },
      orderBy: [{ deadline: "asc" }, { priority: "desc" }],
      take: 20,
    })

    if (allTasks.length === 0) {
      await sendTelegramMessage(chatId, "✅ No open tasks! You're all caught up.")
      return
    }

    let overdue = 0
    let dueToday = 0

    let reply = `📋 <b>Your Tasks</b>\n\n`

    for (const task of allTasks) {
      const priorityIcon =
        task.priority === "urgent" ? "🔴" :
        task.priority === "high" ? "🟠" :
        task.priority === "medium" ? "🟡" : "⚪"

      let status = ""
      if (task.deadline) {
        const dl = new Date(task.deadline)
        if (dl < now) {
          status = " ⚠️ OVERDUE"
          overdue++
        } else if (dl <= todayEnd) {
          status = " — due today"
          dueToday++
        } else {
          status = ` — due ${dl.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`
        }
      }

      reply += `${priorityIcon} ${esc(task.title)}${status}\n`
    }

    reply += `\n<b>Total: ${allTasks.length} tasks</b>`
    if (overdue > 0) reply += ` · <b>${overdue} overdue</b>`
    if (dueToday > 0) reply += ` · ${dueToday} due today`

    await sendTelegramMessage(chatId, reply)
  } catch (error) {
    tgLog.error({ err: serializeError(error), command: "/tasks" }, "telegram command failed")
    await sendTelegramMessage(chatId, "❌ Failed to fetch tasks. Try again later.")
  }
}

// ═══════════════════════════════════════════════════════
//  Regular messages (not commands)
// ═══════════════════════════════════════════════════════

async function handleRegularMessage(chatId: number, text: string, fromName: string) {
  const employee = await findEmployeeByChatId(chatId)

  if (!employee) {
    // ─── Check if this is an email for account linking ───
    if (text.includes("@") && !text.includes(" ")) {
      await handleEmailLinking(chatId, text)
      return
    }

    // ─── Non-employee: auto-create support ticket ───
    try {
      const { createAutoTicket } = await import("@/lib/support-auto")
      const result = await createAutoTicket({
        subject: text.length > 50 ? text.substring(0, 50) + "..." : text,
        clientName: fromName || `Telegram User ${chatId}`,
        clientEmail: null,
        channel: "telegram",
        message: text,
        source: "telegram",
      })

      const ticketRef = result.ticket.id.slice(-8).toUpperCase()
      await sendTelegramMessage(
        chatId,
        `✅ Your message has been forwarded to our support team.\n\nReference: #${ticketRef}\n\nWe'll respond shortly.`,
      )
    } catch (error) {
      tgLog.error({ err: serializeError(error) }, "telegram auto-ticket failed")
      await sendTelegramMessage(
        chatId,
        "Thank you for your message. To get help, use /support followed by your question.\n\nTo link your Oxen account, send /start",
      )
    }
    return
  }

  // ─── Employee: short messages get tips ───
  if (text.length < 20) {
    await sendTelegramMessage(
      chatId,
      "💡 Tip: Send a meeting note or call summary (20+ chars) and I'll extract action items.\n\n" +
      "Or use a command:\n/brief /digest /pipeline /tasks /support",
    )
    return
  }

  // ─── Employee: process as meeting note ───
  await handleMeetingNote(chatId, text)
}

// ═══════════════════════════════════════════════════════
//  Meeting note processing (AI extraction)
// ═══════════════════════════════════════════════════════

async function handleMeetingNote(chatId: number, text: string) {
  const employee = await findEmployeeByChatId(chatId)
  if (!employee) return

  await sendTelegramMessage(chatId, "⏳ Processing your meeting note...", "")

  try {
    const prompt = `Extract from this meeting note / call summary. Return ONLY valid JSON.

NOTE:
${text}

Return JSON:
{
  "summary": "2-3 sentence structured summary",
  "action_items": [{"task": "description", "assignee": "name or ?"}],
  "deal_updates": ["any deal-related updates"],
  "sentiment": "positive|neutral|negative"
}

Be specific and extract all actionable items.`

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    })

    const responseText = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")

    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      await sendTelegramMessage(chatId, "📝 Got it. What should I do with this note?\n\n" +
        "1️⃣ Save as general note\n2️⃣ Link to a contact (reply with contact name)\n3️⃣ Create a task from this\n\n" +
        "Reply with the client or company name to link, or 'skip' to save without linking.")
      pendingNotes.set(chatId, {
        summary: text.substring(0, 200),
        actionItems: [],
        dealUpdates: [],
        rawNote: text,
      })
      return
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      summary: string
      action_items: Array<{ task: string; assignee: string }>
      deal_updates: string[]
      sentiment: string
    }

    // Store pending note for linking
    pendingNotes.set(chatId, {
      summary: parsed.summary,
      actionItems: parsed.action_items.map((a) => `${a.task} → ${a.assignee}`),
      dealUpdates: parsed.deal_updates || [],
      rawNote: text,
    })

    // Format reply
    let reply = `✅ <b>Got it. Here's what I captured:</b>\n\n`
    reply += `📝 <b>Summary</b>\n${esc(parsed.summary)}\n\n`

    if (parsed.action_items.length > 0) {
      reply += `📋 <b>Action Items</b>\n`
      for (const ai of parsed.action_items) {
        reply += `• ${esc(ai.task)} → <i>${esc(ai.assignee)}</i>\n`
      }
      reply += "\n"
    }

    if (parsed.deal_updates.length > 0) {
      reply += `💰 <b>Deal Updates</b>\n`
      for (const du of parsed.deal_updates) {
        reply += `• ${esc(du)}\n`
      }
      reply += "\n"
    }

    reply += `🔗 Reply with a <b>client or company name</b> to link this note, or "skip" to save without linking.`

    await sendTelegramMessage(chatId, reply)
  } catch (error) {
    tgLog.error({ err: serializeError(error) }, "telegram meeting note failed")
    await sendTelegramMessage(chatId, "❌ Failed to process note. Try again.")
  }
}

// ═══════════════════════════════════════════════════════
//  Link note to CRM contact
// ═══════════════════════════════════════════════════════

async function handleNoteLinking(chatId: number, contactQuery: string) {
  const employee = await findEmployeeByChatId(chatId)
  const noteData = pendingNotes.get(chatId)
  if (!noteData || !employee) {
    pendingNotes.delete(chatId)
    return
  }

  // Allow skip
  if (["skip", "no", "cancel"].includes(contactQuery.toLowerCase())) {
    pendingNotes.delete(chatId)
    await sendTelegramMessage(chatId, "👌 Note saved without contact link.")
    return
  }

  try {
    // Search contacts
    const contacts = await prisma.crmContact.findMany({
      where: {
        OR: [
          { firstName: { contains: contactQuery, mode: "insensitive" } },
          { lastName: { contains: contactQuery, mode: "insensitive" } },
          { company: { name: { contains: contactQuery, mode: "insensitive" } } },
        ],
      },
      include: { company: { select: { id: true, name: true } } },
      take: 5,
    })

    if (contacts.length === 0) {
      pendingNotes.delete(chatId)
      await sendTelegramMessage(chatId, `❌ No contact found for "${esc(contactQuery)}". Note saved without link.`)
      return
    }

    // Use first match
    const contact = contacts[0]

    // Create CRM activity
    await prisma.activity.create({
      data: {
        contactId: contact.id,
        type: "call",
        description: `[Telegram Note] ${noteData.summary}\n\nAction Items:\n${noteData.actionItems.join("\n")}\n\nOriginal: ${noteData.rawNote}`,
        performedBy: employee.name,
      },
    })

    // Create tasks for action items
    let tasksCreated = 0
    for (const item of noteData.actionItems) {
      const parts = item.split(" → ")
      const taskTitle = parts[0] || item
      const assignee = parts[1] !== "?" ? parts[1] : employee.name

      await prisma.task.create({
        data: {
          title: taskTitle,
          column: "todo",
          priority: "medium",
          tag: "follow-up",
          assignee: assignee || employee.name,
          createdBy: employee.name,
          description: `From meeting note by ${employee.name} re: ${contact.company?.name || `${contact.firstName} ${contact.lastName}`}`,
        },
      })
      tasksCreated++
    }

    pendingNotes.delete(chatId)

    await sendTelegramMessage(
      chatId,
      `✅ Linked to <b>${esc(contact.firstName)} ${esc(contact.lastName)}</b> (${esc(contact.company?.name || "?")}).\n\n` +
      `📝 Interaction saved\n📋 ${tasksCreated} task${tasksCreated !== 1 ? "s" : ""} created`,
    )
  } catch (error) {
    tgLog.error({ err: serializeError(error) }, "telegram note linking failed")
    pendingNotes.delete(chatId)
    await sendTelegramMessage(chatId, "❌ Failed to link note. Try again.")
  }
}

// ═══════════════════════════════════════════════════════
//  Email linking (from /start flow)
// ═══════════════════════════════════════════════════════

async function handleEmailLinking(chatId: number, email: string) {
  const cleaned = email.trim().toLowerCase()
  tgLog.info({ chatId, email: cleaned }, "telegram email linking attempt")

  const employee = await prisma.employee.findFirst({
    where: { email: { equals: cleaned, mode: "insensitive" } },
  })

  if (!employee) {
    await sendTelegramMessage(
      chatId,
      `❌ Email not found in the system. Make sure you use your Oxen email address.`,
    )
    return
  }

  await prisma.employee.update({
    where: { id: employee.id },
    data: { telegramChatId: String(chatId) },
  })

  tgLog.info({ chatId, employeeName: employee.name, employeeEmail: employee.email }, "telegram chat linked to employee")

  await sendTelegramMessage(
    chatId,
    `✅ Account linked to <b>${esc(employee.name)}</b>. You'll now receive notifications here.\n\n` +
    `<b>Commands:</b>\n` +
    `/brief — Next meeting brief\n` +
    `/digest — Daily digest\n` +
    `/pipeline — Pipeline summary\n` +
    `/tasks — Today's tasks\n` +
    `/support [msg] — Create support ticket\n` +
    `/myid — Your chat ID`,
  )
}

// ═══════════════════════════════════════════════════════
//  Callback query handler (inline keyboard buttons)
// ═══════════════════════════════════════════════════════

async function handleCallbackQuery(chatId: number, data: string, queryId: string) {
  tgLog.info({ chatId, data }, "telegram callback query")

  // Answer the callback to stop loading spinner
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ""
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: queryId }),
  })

  // Route callback data
  if (data === "cmd_brief") {
    await handleBrief(chatId)
  } else if (data === "cmd_digest") {
    await handleDigest(chatId)
  } else if (data === "cmd_pipeline") {
    await handlePipeline(chatId)
  } else if (data === "cmd_tasks") {
    await handleTasks(chatId)
  }
}

// ═══════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════

async function findEmployeeByChatId(chatId: number) {
  return prisma.employee.findFirst({
    where: { telegramChatId: String(chatId) },
    select: { id: true, name: true, email: true },
  })
}
