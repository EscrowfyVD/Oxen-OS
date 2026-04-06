import { prisma } from "@/lib/prisma"
import { SLA_TIMES, getNextAgent, detectPriority } from "@/lib/support-config"
import { sendTelegramMessage } from "@/lib/telegram"

interface AutoTicketInput {
  subject: string
  clientName: string
  clientEmail?: string | null
  channel: string
  category?: string | null
  message?: string | null
  source: string  // "email_auto", "website_form", "telegram"
  priority?: string | null
}

interface AutoTicketResult {
  ticket: { id: string; subject: string; priority: string; assignedTo: string | null }
  contactId: string | null
  slaLabel: string
}

export async function createAutoTicket(input: AutoTicketInput): Promise<AutoTicketResult> {
  // 1. Find CRM contact by email
  let contactId: string | null = null
  let dealValue: number | null = null
  if (input.clientEmail) {
    const contact = await prisma.crmContact.findFirst({
      where: { email: { equals: input.clientEmail, mode: "insensitive" } },
      select: { id: true, deals: { select: { dealValue: true }, where: { stage: { notIn: ["closed_won", "closed_lost"] } }, take: 1 } },
    })
    if (contact) {
      contactId = contact.id
      dealValue = contact.deals[0]?.dealValue ?? null
    }
  }

  // 2. Determine priority
  const priority = input.priority || detectPriority(input.subject, dealValue)

  // 3. Round-robin assignment
  const lastTicket = await prisma.supportTicket.findFirst({
    orderBy: { createdAt: "desc" },
    select: { assignedTo: true },
  })
  const assignedTo = getNextAgent(lastTicket?.assignedTo)

  // 4. Get SLA times
  const sla = SLA_TIMES[priority] || SLA_TIMES.medium

  // 5. Create ticket
  const ticket = await prisma.supportTicket.create({
    data: {
      subject: input.subject,
      clientName: input.clientName,
      clientEmail: input.clientEmail || null,
      channel: input.channel,
      category: input.category || null,
      priority,
      assignedTo,
      contactId,
      source: input.source,
      slaResponseMinutes: sla.responseMinutes,
      slaResolutionMinutes: sla.resolutionMinutes,
      createdBy: `auto:${input.source}`,
      ...(input.message && {
        messages: {
          create: {
            sender: "client",
            content: input.message,
            isInternal: false,
          },
        },
      }),
    },
  })

  // 6. Telegram notification to assigned agent
  try {
    const agent = await prisma.employee.findFirst({
      where: { name: assignedTo },
      select: { telegramChatId: true },
    })
    if (agent?.telegramChatId) {
      await sendTelegramMessage(
        agent.telegramChatId,
        `🎧 <b>New Support Ticket</b>\n\n📋 ${input.subject}\n👤 ${input.clientName}${input.clientEmail ? `\n📧 ${input.clientEmail}` : ""}\n📌 Priority: ${priority}\n📡 Channel: ${input.channel}\n\nAssigned to you.`,
      )
    }
  } catch {
    // best effort
  }

  return {
    ticket: { id: ticket.id, subject: ticket.subject, priority, assignedTo },
    contactId,
    slaLabel: sla.label,
  }
}
