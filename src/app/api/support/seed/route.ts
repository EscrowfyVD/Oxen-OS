import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const channels = ["telegram", "email", "whatsapp", "phone", "live_chat"]
const categories = ["account_issue", "transaction", "onboarding", "compliance", "technical", "general"]
const statuses = ["open", "in_progress", "waiting_client", "resolved", "closed"]
const priorities = ["urgent", "high", "medium", "low"]
const agents = ["Christel", "Tsiaro"]

const subjects = [
  "Cannot access my account",
  "Transaction pending for 3 days",
  "Need help with onboarding documents",
  "KYC verification stuck",
  "Payment not received by beneficiary",
  "How to set up recurring transfers?",
  "Card activation issue",
  "Compliance document request",
  "API integration error",
  "Exchange rate question",
  "Account limits increase request",
  "Two-factor authentication not working",
  "Refund not processed",
  "Transfer failed — insufficient funds error",
  "New client onboarding assistance",
  "Report suspicious activity",
  "Invoice discrepancy",
  "Unable to change email address",
  "Mobile app crash on login",
  "Currency conversion clarification",
  "Delayed SEPA transfer",
  "Need statement for last quarter",
  "Webhook notifications not arriving",
  "Client wants to close account",
  "Compliance audit follow-up",
]

const clientNames = [
  "Alexandre Martin", "Sofia Andrade", "Jean-Pierre Duval", "Marina Voronova",
  "David Chen", "Fatima Al-Hassan", "Lukas Müller", "Isabella Rossi",
  "Yuki Tanaka", "Carlos Ramirez", "Elena Petrova", "Mohammed Khalil",
  "Anna Kowalski", "Pierre Beaumont", "Sarah Thompson",
]

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomDate(daysAgo: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - Math.floor(Math.random() * daysAgo))
  d.setHours(Math.floor(Math.random() * 10) + 8, Math.floor(Math.random() * 60))
  return d
}

export async function POST() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userId = session.user?.id ?? session.user?.email ?? "unknown"

  // Create 25 tickets spread over last 30 days
  for (let i = 0; i < 25; i++) {
    const createdAt = randomDate(30)
    const status = randomFrom(statuses)
    const priority = randomFrom(priorities)
    const agent = randomFrom(agents)
    const clientName = randomFrom(clientNames)
    const channel = randomFrom(channels)
    const category = randomFrom(categories)

    let resolvedAt: Date | null = null
    let firstResponseAt: Date | null = null

    // Set firstResponseAt for non-open tickets
    if (status !== "open") {
      firstResponseAt = new Date(createdAt.getTime() + (Math.random() * 60 + 5) * 60 * 1000) // 5-65 mins
    }

    // Set resolvedAt for resolved/closed tickets
    if (status === "resolved" || status === "closed") {
      resolvedAt = new Date(createdAt.getTime() + (Math.random() * 24 + 1) * 60 * 60 * 1000) // 1-25 hours
    }

    const ticket = await prisma.supportTicket.create({
      data: {
        subject: subjects[i % subjects.length],
        clientName,
        clientEmail: `${clientName.toLowerCase().replace(/ /g, ".")}@example.com`,
        channel,
        status,
        priority,
        category,
        assignedTo: agent,
        resolvedAt,
        firstResponseAt,
        createdBy: userId,
        createdAt,
      },
    })

    // Add 2-5 messages per ticket
    const numMessages = Math.floor(Math.random() * 4) + 2
    let msgTime = new Date(createdAt.getTime() + 1000)

    for (let j = 0; j < numMessages; j++) {
      const isClient = j === 0 || Math.random() > 0.5
      const isInternal = !isClient && Math.random() > 0.7

      await prisma.supportMessage.create({
        data: {
          ticketId: ticket.id,
          sender: isClient ? "client" : agent,
          content: isClient
            ? getClientMessage(j, category)
            : isInternal
              ? getInternalNote(category)
              : getAgentMessage(j, category),
          isInternal,
          createdAt: msgTime,
        },
      })

      msgTime = new Date(msgTime.getTime() + (Math.random() * 120 + 10) * 60 * 1000)
    }
  }

  return NextResponse.json({ success: true, message: "Seeded 25 support tickets with messages" })
}

function getClientMessage(idx: number, category: string): string {
  const messages: Record<string, string[]> = {
    account_issue: [
      "I cannot log into my account. I've tried resetting my password but nothing works.",
      "Still having the same issue. Can you please escalate this?",
      "Thank you, I can access my account now.",
    ],
    transaction: [
      "I made a transfer 3 days ago and the beneficiary hasn't received it yet. Reference: TXN-2024-00812",
      "Can you check the status? The amount is EUR 15,000.",
      "OK, I'll wait. Please keep me updated.",
    ],
    onboarding: [
      "I'd like to open an account for my company. What documents do I need?",
      "I've uploaded all the documents. How long does verification take?",
      "Thanks for the quick response!",
    ],
    compliance: [
      "I received a request for additional documents. What exactly do you need?",
      "I've sent the requested documents via email as well.",
      "When will my account be unblocked?",
    ],
    technical: [
      "The mobile app keeps crashing when I try to make a transfer.",
      "I'm using iPhone 15, iOS 17.4. It crashes every time.",
      "The update fixed it. Works fine now.",
    ],
    general: [
      "Hello, I have a question about your services.",
      "Could you send me more details about the pricing?",
      "Perfect, thank you for the information.",
    ],
  }
  const msgs = messages[category] || messages.general
  return msgs[idx % msgs.length]
}

function getAgentMessage(idx: number, category: string): string {
  const messages = [
    "Thank you for reaching out. I'm looking into this right now.",
    "I've checked your account and I can see the issue. Let me work on a resolution.",
    "I've escalated this to the relevant team. You should see a resolution within 24 hours.",
    "Your issue has been resolved. Is there anything else I can help with?",
    "I've updated your account settings. Please try logging in again.",
  ]
  return messages[idx % messages.length]
}

function getInternalNote(category: string): string {
  const notes = [
    "Client has been with us for 6 months. VIP handling required.",
    "Need to check with compliance team before proceeding.",
    "Transaction flagged by automated system — manual review done, all clear.",
    "Previous ticket about same issue was resolved 2 weeks ago. Recurring problem.",
    "Escalated to technical team. Waiting for fix in next release.",
  ]
  return notes[Math.floor(Math.random() * notes.length)]
}
