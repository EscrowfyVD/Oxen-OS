import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendTelegramMessage, formatBriefForTelegram } from "@/lib/telegram"
import Anthropic from "@anthropic-ai/sdk"

const anthropic = new Anthropic()

interface TelegramUpdate {
  message?: {
    message_id: number
    from: { id: number; first_name: string; username?: string }
    chat: { id: number; type: string }
    text?: string
    date: number
  }
}

// State for pending note-linking (in-memory, per chatId)
const pendingNotes = new Map<
  number,
  { summary: string; actionItems: string[]; dealUpdates: string[]; rawNote: string }
>()

export async function POST(request: Request) {
  try {
    const update: TelegramUpdate = await request.json()
    const msg = update.message
    if (!msg?.text) return NextResponse.json({ ok: true })

    const chatId = msg.chat.id
    const text = msg.text.trim()

    // ─── Commands ───────────────────────────────────────
    if (text.startsWith("/start")) {
      await handleStart(chatId)
    } else if (text.startsWith("/myid")) {
      await handleMyId(chatId)
    } else if (text.startsWith("/brief")) {
      await handleBrief(chatId)
    } else if (text.startsWith("/digest")) {
      await handleDigest(chatId)
    } else if (pendingNotes.has(chatId)) {
      // User is replying with a contact name to link their note
      await handleNoteLinking(chatId, text)
    } else {
      // Regular text → treat as meeting note
      await handleMeetingNote(chatId, text)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Telegram webhook error:", error)
    return NextResponse.json({ ok: true }) // Always 200 so Telegram doesn't retry
  }
}

// ─── /start — Link Telegram to Employee ─────────────────

async function handleStart(chatId: number) {
  await sendTelegramMessage(
    chatId,
    "Welcome to Oxen OS Bot 🏛\n\nSend me your @oxen.finance email to link your account.",
  )

  // Check if already linked
  const existing = await prisma.employee.findFirst({
    where: { telegramChatId: String(chatId) },
  })
  if (existing) {
    await sendTelegramMessage(
      chatId,
      `You're already linked as *${existing.name}*. You'll receive meeting briefs and notifications here.`,
    )
  }
}

// ─── /myid — Show chat ID ───────────────────────────────

async function handleMyId(chatId: number) {
  await sendTelegramMessage(chatId, `Your Telegram Chat ID: \`${chatId}\``, "Markdown")
}

// ─── /brief — Next upcoming meeting brief ───────────────

async function handleBrief(chatId: number) {
  const employee = await findEmployeeByChatId(chatId)
  if (!employee) {
    await sendTelegramMessage(chatId, "❌ Your account is not linked. Send /start to set up.")
    return
  }

  // Find next meeting brief where this employee's email is in attendees
  const now = new Date()
  const briefs = await prisma.meetingBrief.findMany({
    where: { meetingDate: { gte: now } },
    orderBy: { meetingDate: "asc" },
    take: 10,
  })

  // Match brief to employee email
  const myBrief = briefs.find((b) =>
    b.attendees.some(
      (a) =>
        a.toLowerCase().includes(employee.email?.toLowerCase() || "___") ||
        a.toLowerCase().includes(employee.name.toLowerCase()),
    ),
  )

  if (!myBrief) {
    await sendTelegramMessage(chatId, "📭 No upcoming meeting briefs found for you.")
    return
  }

  const formatted = formatBriefForTelegram({
    title: myBrief.title,
    meetingDate: myBrief.meetingDate,
    attendees: myBrief.attendees,
    briefContent: myBrief.briefContent as Record<string, unknown>,
  })
  await sendTelegramMessage(chatId, formatted)
}

// ─── /digest — Generate and send daily digest ───────────

async function handleDigest(chatId: number) {
  const employee = await findEmployeeByChatId(chatId)
  if (!employee) {
    await sendTelegramMessage(chatId, "❌ Your account is not linked. Send /start to set up.")
    return
  }

  await sendTelegramMessage(chatId, "⏳ Generating your daily digest...")

  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    // Gather context
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
    } catch { /* calendar may not exist */ }

    // Open tasks
    const tasks = await prisma.task.findMany({
      where: { column: { not: "done" } },
      orderBy: { createdAt: "desc" },
      take: 10,
    })
    if (tasks.length > 0) {
      contextParts.push("\n## Open Tasks")
      for (const t of tasks) {
        contextParts.push(`- [${t.priority}] ${t.title} — ${t.column} ${t.assignee ? `(${t.assignee})` : ""}`)
      }
    }

    // Active deals
    const deals = await prisma.deal.findMany({
      where: { stage: { notIn: ["closed_won", "closed_lost"] } },
      include: { contact: { select: { firstName: true, lastName: true, company: { select: { id: true, name: true } } } } },
      orderBy: { dealValue: "desc" },
      take: 10,
    })
    if (deals.length > 0) {
      contextParts.push("\n## Active Pipeline")
      let totalValue = 0
      for (const d of deals) {
        totalValue += d.dealValue || 0
        contextParts.push(`- ${d.dealName} (${d.contact?.company?.name || (d.contact ? `${d.contact.firstName} ${d.contact.lastName}` : "?")}) — ${d.stage} — €${d.dealValue?.toLocaleString() || "?"}`)
      }
      contextParts.push(`Total pipeline: €${totalValue.toLocaleString()}`)
    }

    const prompt = `Generate a concise daily digest for ${employee.name} at Oxen Finance. Today is ${today.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}.

${contextParts.join("\n")}

Format as plain text (no markdown formatting) with:
1. Priority Actions — Top 3 things
2. Today's Meetings — Brief on each
3. Pipeline Pulse — Key deals
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
      `🏛 *Daily Digest — Oxen OS*\n\n${digest}`,
    )
  } catch (error) {
    console.error("Telegram digest error:", error)
    await sendTelegramMessage(chatId, "❌ Failed to generate digest. Try again later.")
  }
}

// ─── Meeting note processing ────────────────────────────

async function handleMeetingNote(chatId: number, text: string) {
  const employee = await findEmployeeByChatId(chatId)
  if (!employee) {
    // If not linked, check if this looks like an email for account linking
    if (text.includes("@")) {
      await handleEmailLinking(chatId, text)
      return
    }
    await sendTelegramMessage(chatId, "❌ Your account is not linked. Send /start first.")
    return
  }

  // Short messages might be accidental
  if (text.length < 20) {
    await sendTelegramMessage(chatId, "💡 Send a meeting note or call summary (20+ chars) and I'll extract action items and key points.\n\nCommands: /brief /digest /myid")
    return
  }

  await sendTelegramMessage(chatId, "⏳ Processing your meeting note...")

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
      await sendTelegramMessage(chatId, "❌ Could not parse the note. Try rephrasing.")
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
      dealUpdates: parsed.deal_updates,
      rawNote: text,
    })

    // Format reply
    let reply = "✅ *Got it. Here's what I captured:*\n\n"
    reply += `📝 *Summary*\n${parsed.summary}\n\n`

    if (parsed.action_items.length > 0) {
      reply += `📋 *Action Items*\n`
      for (const ai of parsed.action_items) {
        reply += `• ${ai.task} → _${ai.assignee}_\n`
      }
      reply += "\n"
    }

    if (parsed.deal_updates.length > 0) {
      reply += `💰 *Deal Updates*\n`
      for (const du of parsed.deal_updates) {
        reply += `• ${du}\n`
      }
      reply += "\n"
    }

    reply += `🔗 Link this to a contact? Reply with the client or company name.`

    await sendTelegramMessage(chatId, reply)
  } catch (error) {
    console.error("Meeting note error:", error)
    await sendTelegramMessage(chatId, "❌ Failed to process note. Try again.")
  }
}

// ─── Link note to contact ───────────────────────────────

async function handleNoteLinking(chatId: number, contactQuery: string) {
  const employee = await findEmployeeByChatId(chatId)
  const noteData = pendingNotes.get(chatId)
  if (!noteData || !employee) {
    pendingNotes.delete(chatId)
    return
  }

  // Allow skip
  if (contactQuery.toLowerCase() === "skip" || contactQuery.toLowerCase() === "no") {
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
      await sendTelegramMessage(chatId, `❌ No contact found for "${contactQuery}". Note saved without link.`)
      return
    }

    // Use first match
    const contact = contacts[0]

    // Create interaction
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
      `✅ Linked to *${contact.firstName} ${contact.lastName}* (${contact.company?.name || "?"}).\n\n📝 Interaction saved\n📋 ${tasksCreated} task${tasksCreated !== 1 ? "s" : ""} created`,
    )
  } catch (error) {
    console.error("Note linking error:", error)
    pendingNotes.delete(chatId)
    await sendTelegramMessage(chatId, "❌ Failed to link note. Try again.")
  }
}

// ─── Email linking (from /start flow) ───────────────────

async function handleEmailLinking(chatId: number, email: string) {
  const cleaned = email.trim().toLowerCase()

  const employee = await prisma.employee.findFirst({
    where: { email: { equals: cleaned, mode: "insensitive" } },
  })

  if (!employee) {
    await sendTelegramMessage(chatId, `❌ No employee found with email "${cleaned}". Check and try again.`)
    return
  }

  await prisma.employee.update({
    where: { id: employee.id },
    data: { telegramChatId: String(chatId) },
  })

  await sendTelegramMessage(
    chatId,
    `✅ Linked to *${employee.name}*. You'll receive meeting briefs and notifications here.\n\nCommands:\n/brief — Next meeting brief\n/digest — Daily digest\n/myid — Your chat ID`,
  )
}

// ─── Helpers ────────────────────────────────────────────

async function findEmployeeByChatId(chatId: number) {
  return prisma.employee.findFirst({
    where: { telegramChatId: String(chatId) },
    select: { id: true, name: true, email: true },
  })
}
