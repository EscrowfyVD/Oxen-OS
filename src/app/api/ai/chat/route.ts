import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Anthropic from "@anthropic-ai/sdk"
import { getAccessTokenForUser, readDriveFileContent } from "@/lib/google-drive"

const anthropic = new Anthropic()

const SYSTEM_PROMPT = `You are Sentinel, the AI sales intelligence engine for Oxen Finance, a premium private banking and payment infrastructure platform based in Europe.

You help the sales team (Andy, Paul Louis, Erwin) and leadership (Vernon, Arthur) manage client relationships and close deals. Support is handled by Christel and Tsiaro.

You have access to the company's internal CRM data which is provided as context. Use it to give specific, actionable answers. Always reference real data when available.

Your capabilities:
1. RESEARCH: Analyze companies, find key people, assess fit for Oxen's services
2. MEETING PREP: Generate comprehensive meeting briefs from contact history, deal status, and company research
3. INSIGHTS: Identify opportunities, risks, buying signals, and follow-up needs
4. CRM ACTIONS: Help update deals, add notes, create tasks
5. WEEKLY DIGEST: Summarize pipeline status, key meetings, action items

When suggesting actions, output them as JSON blocks on their own line, wrapped in triple backticks with "action-json" language tag:
\`\`\`action-json
{"action": "create_task", "data": {"title": "...", "assignee": "...", "deadline": "..."}}
\`\`\`
\`\`\`action-json
{"action": "add_note", "data": {"contactId": "...", "content": "..."}}
\`\`\`
\`\`\`action-json
{"action": "update_deal", "data": {"dealId": "...", "stage": "..."}}
\`\`\`

Oxen's target sectors: iGaming operators, crypto businesses, family offices, luxury asset brokers, high-net-worth individuals.
Services: multi-currency accounts, SEPA/SWIFT payments, crypto-to-fiat exchange, card issuing, compliance-first onboarding.

Be concise, specific, and always end with clear next steps. Format responses with markdown headers, bullet points, and bold text for readability.`

export async function POST(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userId = session.user?.id ?? session.user?.email ?? "unknown"
  const body = await request.json()
  const { message, conversationId } = body

  if (!message?.trim()) {
    return NextResponse.json({ error: "message is required" }, { status: 400 })
  }

  try {
    // Gather DB context based on message intent
    const userEmail = session.user?.email ?? ""
    const context = await gatherContext(message, userEmail)

    // Load or create conversation
    let conversation: { id: string; messages: Array<{ role: string; content: string; timestamp: string }> }
    if (conversationId) {
      const existing = await prisma.aIConversation.findUnique({ where: { id: conversationId } })
      if (existing) {
        conversation = { id: existing.id, messages: existing.messages as Array<{ role: string; content: string; timestamp: string }> }
      } else {
        conversation = { id: "", messages: [] }
      }
    } else {
      conversation = { id: "", messages: [] }
    }

    // Add user message
    conversation.messages.push({
      role: "user",
      content: message,
      timestamp: new Date().toISOString(),
    })

    // Build messages for Claude (last 20 messages to avoid token overflow)
    const recentMessages = conversation.messages.slice(-20)
    const claudeMessages = recentMessages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }))

    // Add context as a system-injected user message if we have it
    const systemWithContext = context
      ? `${SYSTEM_PROMPT}\n\n--- INTERNAL CRM DATA (current as of ${new Date().toISOString()}) ---\n${context}`
      : SYSTEM_PROMPT

    // Call Claude API
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: systemWithContext,
      messages: claudeMessages,
    })

    const assistantContent = response.content
      .filter((block) => block.type === "text")
      .map((block) => {
        if (block.type === "text") return block.text
        return ""
      })
      .join("\n")

    // Add assistant response to conversation
    conversation.messages.push({
      role: "assistant",
      content: assistantContent,
      timestamp: new Date().toISOString(),
    })

    // Save conversation
    let savedConvId: string
    if (conversation.id) {
      await prisma.aIConversation.update({
        where: { id: conversation.id },
        data: { messages: conversation.messages, updatedAt: new Date() },
      })
      savedConvId = conversation.id
    } else {
      const created = await prisma.aIConversation.create({
        data: { messages: conversation.messages, userId },
      })
      savedConvId = created.id
    }

    // Parse action blocks from response
    const actions = parseActions(assistantContent)

    return NextResponse.json({
      response: assistantContent,
      conversationId: savedConvId,
      actions,
    })
  } catch (error) {
    console.error("AI chat error:", error)
    return NextResponse.json({ error: "AI request failed" }, { status: 500 })
  }
}

async function gatherContext(message: string, userEmail: string): Promise<string> {
  const parts: string[] = []
  const msgLower = message.toLowerCase()

  // If mentions a specific company/contact, fetch it
  const contacts = await prisma.contact.findMany({
    take: 10,
    orderBy: { updatedAt: "desc" },
    include: {
      interactions: { take: 5, orderBy: { createdAt: "desc" } },
      deals: { take: 5, orderBy: { updatedAt: "desc" } },
      metrics: { take: 3, orderBy: { month: "desc" } },
    },
  })

  // Pipeline / deal context
  if (msgLower.includes("pipeline") || msgLower.includes("deal") || msgLower.includes("risk") || msgLower.includes("revenue") || msgLower.includes("client") || msgLower.includes("digest") || msgLower.includes("overview")) {
    const deals = await prisma.deal.findMany({
      where: { stage: { not: "closed_lost" } },
      include: { contact: { select: { name: true, company: true, healthStatus: true, segment: true } } },
      orderBy: { updatedAt: "desc" },
      take: 20,
    })
    if (deals.length > 0) {
      parts.push("## Active Deals")
      for (const d of deals) {
        parts.push(`- ${d.name} | ${d.contact?.company || d.contact?.name || "?"} | Stage: ${d.stage} | Revenue: €${d.expectedRevenue?.toLocaleString() || "?"} | Probability: ${d.probability || "?"}% | Owner: ${d.assignedTo || "?"}`)
      }
    }
  }

  // Contact context
  if (contacts.length > 0) {
    parts.push("## Recent Contacts")
    for (const c of contacts) {
      let line = `- ${c.name} (${c.company || "no company"}) | Status: ${c.status} | Health: ${c.healthStatus} | Sector: ${c.sector || "?"}`
      if (c.monthlyGtv) line += ` | GTV: €${c.monthlyGtv.toLocaleString()}/mo`
      if (c.assignedTo) line += ` | Owner: ${c.assignedTo}`
      parts.push(line)

      if (c.interactions.length > 0) {
        for (const i of c.interactions.slice(0, 2)) {
          parts.push(`  · [${i.type}] ${i.content.substring(0, 100)}${i.content.length > 100 ? "..." : ""} (${new Date(i.createdAt).toLocaleDateString()})`)
        }
      }
    }
  }

  // Tasks context
  if (msgLower.includes("task") || msgLower.includes("todo") || msgLower.includes("digest")) {
    const tasks = await prisma.task.findMany({
      where: { column: { not: "done" } },
      orderBy: { createdAt: "desc" },
      take: 10,
    })
    if (tasks.length > 0) {
      parts.push("## Open Tasks")
      for (const t of tasks) {
        parts.push(`- ${t.title} | Column: ${t.column} | Priority: ${t.priority} | Assignee: ${t.assignee || "?"}`)
      }
    }
  }

  // Meeting context
  if (msgLower.includes("meeting") || msgLower.includes("calendar") || msgLower.includes("brief") || msgLower.includes("prepare") || msgLower.includes("digest")) {
    try {
      const events = await prisma.calendarEvent.findMany({
        where: { startTime: { gte: new Date() } },
        orderBy: { startTime: "asc" },
        take: 10,
      })
      if (events.length > 0) {
        parts.push("## Upcoming Meetings")
        for (const e of events) {
          const attendeeList = e.attendees.join(", ")
          parts.push(`- ${e.title} | ${new Date(e.startTime).toLocaleDateString()} ${new Date(e.startTime).toLocaleTimeString()} | Attendees: ${attendeeList || "none listed"}`)
        }
      }
    } catch { /* calendar may not exist */ }
  }

  // Leave / absence context
  if (msgLower.includes("leave") || msgLower.includes("absence") || msgLower.includes("vacation") || msgLower.includes("sick") || msgLower.includes("ooo") || msgLower.includes("who is out") || msgLower.includes("available") || msgLower.includes("assign") || msgLower.includes("digest")) {
    try {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const activeLeaves = await prisma.leaveRequest.findMany({
        where: {
          status: "approved",
          startDate: { lte: new Date() },
          endDate: { gte: today },
        },
        include: { employee: { select: { name: true, department: true } } },
      })
      if (activeLeaves.length > 0) {
        parts.push("## Currently On Leave")
        for (const l of activeLeaves) {
          parts.push(`- ${l.employee.name} (${l.employee.department}): ${l.type} from ${new Date(l.startDate).toLocaleDateString()} to ${new Date(l.endDate).toLocaleDateString()}`)
        }
      }
      const pendingLeaves = await prisma.leaveRequest.findMany({
        where: { status: "pending" },
        include: { employee: { select: { name: true } } },
        take: 10,
      })
      if (pendingLeaves.length > 0) {
        parts.push("## Pending Leave Requests")
        for (const l of pendingLeaves) {
          parts.push(`- ${l.employee.name}: ${l.type} ${new Date(l.startDate).toLocaleDateString()}-${new Date(l.endDate).toLocaleDateString()} (${l.totalDays} days)`)
        }
      }
    } catch { /* leave tables may not exist yet */ }
  }

  // Search for specific contact/company mentioned
  const words = message.split(/\s+/).filter((w) => w.length > 3)
  for (const word of words.slice(0, 5)) {
    const found = await prisma.contact.findMany({
      where: {
        OR: [
          { name: { contains: word, mode: "insensitive" } },
          { company: { contains: word, mode: "insensitive" } },
        ],
      },
      include: {
        interactions: { take: 5, orderBy: { createdAt: "desc" } },
        deals: { take: 5 },
        companyIntel: { take: 1, orderBy: { updatedAt: "desc" } },
      },
      take: 3,
    })
    for (const c of found) {
      if (parts.some((p) => p.includes(c.name))) continue
      parts.push(`\n## Contact Detail: ${c.name} (${c.company || "no company"})`)
      parts.push(`ID: ${c.id} | Email: ${c.email || "?"} | Phone: ${c.phone || "?"} | Status: ${c.status} | Health: ${c.healthStatus}`)
      if (c.website) parts.push(`Website: ${c.website}`)
      if (c.monthlyGtv) parts.push(`Monthly GTV: €${c.monthlyGtv.toLocaleString()} | Revenue: €${c.monthlyRevenue?.toLocaleString() || "?"}`)
      if (c.notes) parts.push(`Notes: ${c.notes.substring(0, 200)}`)
      if (c.deals.length > 0) {
        parts.push(`Deals:`)
        for (const d of c.deals) parts.push(`  - ${d.name} | Stage: ${d.stage} | Revenue: €${d.expectedRevenue?.toLocaleString() || "?"}`)
      }
      if (c.interactions.length > 0) {
        parts.push(`Recent interactions:`)
        for (const i of c.interactions) parts.push(`  - [${i.type}] ${i.content.substring(0, 150)} (${new Date(i.createdAt).toLocaleDateString()})`)
      }
      if (c.companyIntel.length > 0) {
        const intel = c.companyIntel[0]
        parts.push(`Company Intel: ${intel.description?.substring(0, 200) || "?"} | Industry: ${intel.industry || "?"} | Size: ${intel.employeeCount || "?"}`)
      }
    }
  }

  // Intel context
  if (msgLower.includes("competitor") || msgLower.includes("conference") || msgLower.includes("intel") || msgLower.includes("trend") || msgLower.includes("ai tool") || msgLower.includes("regulation") || msgLower.includes("digest")) {
    try {
      const intelResults = await prisma.intelResult.findMany({
        include: { research: { select: { category: true, subcategory: true } } },
        orderBy: { createdAt: "desc" },
        take: 10,
      })
      if (intelResults.length > 0) {
        parts.push("\n## Recent Intel Results")
        for (const r of intelResults) {
          parts.push(`- [${r.research.category}/${r.research.subcategory || "general"}] ${r.title} | Relevance: ${r.relevance} | Sentiment: ${r.sentiment} | ${r.summary.substring(0, 200)}`)
        }
      }
    } catch { /* intel tables may not exist yet */ }
  }

  // Linked Drive documents for contacts in context
  try {
    const contactIds = contacts.slice(0, 5).map((c) => c.id)
    if (contactIds.length > 0) {
      const driveLinks = await prisma.driveLink.findMany({
        where: { contactId: { in: contactIds } },
        take: 10,
      })
      if (driveLinks.length > 0) {
        const accessToken = userEmail ? await getAccessTokenForUser(userEmail) : null
        if (accessToken) {
          const readableMimes = [
            "application/vnd.google-apps.document",
            "application/vnd.google-apps.spreadsheet",
            "application/vnd.google-apps.presentation",
          ]
          const readableLinks = driveLinks.filter((l) => readableMimes.includes(l.mimeType)).slice(0, 3)
          if (readableLinks.length > 0) {
            parts.push("\n## Linked Drive Documents")
            for (const link of readableLinks) {
              const content = await readDriveFileContent(accessToken, link.driveFileId, link.mimeType)
              if (content) {
                parts.push(`### ${link.fileName} (${link.category || "uncategorized"})`)
                parts.push(content.substring(0, 2000))
              } else {
                parts.push(`- ${link.fileName} (${link.category || "uncategorized"}) — content not readable`)
              }
            }
          }
          const otherLinks = driveLinks.filter((l) => !readableMimes.includes(l.mimeType))
          if (otherLinks.length > 0) {
            parts.push("\n## Other Linked Files (metadata only)")
            for (const link of otherLinks) {
              parts.push(`- ${link.fileName} (${link.category || "uncategorized"}, ${link.mimeType})`)
            }
          }
        }
      }
    }
  } catch { /* drive context is best-effort */ }

  return parts.join("\n")
}

function parseActions(text: string): Array<{ action: string; data: Record<string, unknown> }> {
  const actions: Array<{ action: string; data: Record<string, unknown> }> = []
  const regex = /```action-json\s*\n([\s\S]*?)\n```/g
  let match
  while ((match = regex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim())
      if (parsed.action && parsed.data) {
        actions.push(parsed)
      }
    } catch { /* skip malformed */ }
  }
  return actions
}
