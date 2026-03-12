import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

interface TimelineItem {
  id: string
  type: "interaction" | "insight" | "brief" | "deal_update" | "email"
  title: string
  description: string
  date: string
  metadata: Record<string, unknown>
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  // Fetch all 5 sources in parallel
  const [interactions, insights, briefs, deals, emails] = await Promise.all([
    prisma.interaction.findMany({
      where: { contactId: id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.aIInsight.findMany({
      where: { contactId: id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.meetingBrief.findMany({
      where: { contactId: id },
      orderBy: { meetingDate: "desc" },
    }),
    prisma.deal.findMany({
      where: { contactId: id },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.email.findMany({
      where: { contactId: id },
      orderBy: { date: "desc" },
    }),
  ])

  const items: TimelineItem[] = []

  // Map interactions
  for (const i of interactions) {
    items.push({
      id: i.id,
      type: "interaction",
      title: `${i.type.charAt(0).toUpperCase() + i.type.slice(1)}`,
      description: i.content,
      date: i.createdAt.toISOString(),
      metadata: { interactionType: i.type, createdBy: i.createdBy },
    })
  }

  // Map insights
  for (const i of insights) {
    items.push({
      id: i.id,
      type: "insight",
      title: i.title,
      description: i.summary,
      date: i.createdAt.toISOString(),
      metadata: {
        insightType: i.type,
        insightSeverity: i.severity,
        dismissed: i.dismissed,
        actionTaken: i.actionTaken,
      },
    })
  }

  // Map briefs
  for (const b of briefs) {
    items.push({
      id: b.id,
      type: "brief",
      title: `Meeting Brief: ${b.title}`,
      description: `Prepared for ${b.attendees.join(", ") || "team"}`,
      date: b.meetingDate.toISOString(),
      metadata: { briefStatus: b.status, attendees: b.attendees },
    })
  }

  // Map deal updates
  for (const d of deals) {
    items.push({
      id: d.id,
      type: "deal_update",
      title: `Deal: ${d.name}`,
      description: `Stage: ${d.stage.replace("_", " ")} · ${d.probability}% · ${d.expectedRevenue ? `€${d.expectedRevenue.toLocaleString()}` : "No value"}`,
      date: d.updatedAt.toISOString(),
      metadata: {
        dealStage: d.stage,
        dealName: d.name,
        expectedRevenue: d.expectedRevenue,
        probability: d.probability,
      },
    })
  }

  // Map emails
  for (const e of emails) {
    items.push({
      id: e.id,
      type: "email",
      title: e.subject,
      description: e.snippet || "",
      date: e.date.toISOString(),
      metadata: {
        emailDirection: e.direction,
        emailFrom: e.from,
        emailTo: e.to,
        hasAttachment: e.hasAttachment,
      },
    })
  }

  // Sort by date descending
  items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return NextResponse.json({ items })
}
