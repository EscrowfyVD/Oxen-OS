import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity"
import { sendTelegramNotification } from "@/lib/telegram"
import type { Prisma } from "@prisma/client"

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}

function buildWikiContent(report: {
  summary: string
  keyTakeaways?: unknown
  marketInsights?: string
  competitorSightings?: string
  opportunities?: string
  recommendations?: string
  rating?: number
}) {
  const nodes: unknown[] = []

  // Summary
  nodes.push({
    type: "heading",
    attrs: { level: 2 },
    content: [{ type: "text", text: "Summary" }],
  })
  nodes.push({
    type: "paragraph",
    content: [{ type: "text", text: report.summary }],
  })

  // Key Takeaways
  if (report.keyTakeaways) {
    nodes.push({
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "Key Takeaways" }],
    })
    const takeaways = Array.isArray(report.keyTakeaways) ? report.keyTakeaways : [report.keyTakeaways]
    nodes.push({
      type: "bulletList",
      content: takeaways.map((t: unknown) => ({
        type: "listItem",
        content: [{ type: "paragraph", content: [{ type: "text", text: String(t) }] }],
      })),
    })
  }

  // Market Insights
  if (report.marketInsights) {
    nodes.push({
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "Market Insights" }],
    })
    nodes.push({
      type: "paragraph",
      content: [{ type: "text", text: report.marketInsights }],
    })
  }

  // Competitor Sightings
  if (report.competitorSightings) {
    nodes.push({
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "Competitor Sightings" }],
    })
    nodes.push({
      type: "paragraph",
      content: [{ type: "text", text: report.competitorSightings }],
    })
  }

  // Opportunities
  if (report.opportunities) {
    nodes.push({
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "Opportunities" }],
    })
    nodes.push({
      type: "paragraph",
      content: [{ type: "text", text: report.opportunities }],
    })
  }

  // Recommendations
  if (report.recommendations) {
    nodes.push({
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "Recommendations" }],
    })
    nodes.push({
      type: "paragraph",
      content: [{ type: "text", text: report.recommendations }],
    })
  }

  // Rating
  if (report.rating) {
    nodes.push({
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "Rating" }],
    })
    nodes.push({
      type: "paragraph",
      content: [{ type: "text", text: `${report.rating}/10` }],
    })
  }

  return { type: "doc", content: nodes }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { id } = await params
    const body = await request.json()
    const {
      summary, keyTakeaways, marketInsights, competitorSightings,
      opportunities, recommendations, rating,
    } = body

    if (!summary) {
      return NextResponse.json({ error: "Missing required field: summary" }, { status: 400 })
    }

    const userId = session.user?.email ?? "unknown"

    const conference = await prisma.conference.findUnique({
      where: { id },
      include: {
        attendees: true,
        collectedContacts: {
          where: { addedToCrm: true, contactId: { not: null } },
        },
      },
    })
    if (!conference) {
      return NextResponse.json({ error: "Conference not found" }, { status: 404 })
    }

    // Check if report already exists
    const existingReport = await prisma.conferenceReport.findUnique({
      where: { conferenceId: id },
    })
    if (existingReport) {
      return NextResponse.json({ error: "Report already exists for this conference" }, { status: 409 })
    }

    // Create WikiPage
    const wikiTitle = `${conference.name} — Report`
    const slug = generateSlug(wikiTitle)
    const wikiContent = buildWikiContent({
      summary, keyTakeaways, marketInsights, competitorSightings,
      opportunities, recommendations, rating,
    })

    const wikiPage = await prisma.wikiPage.create({
      data: {
        title: wikiTitle,
        slug,
        category: "Conferences",
        icon: "\uD83C\uDFAA",
        content: wikiContent as unknown as Prisma.InputJsonValue,
        createdBy: userId,
        updatedBy: userId,
      },
    })

    // Create ConferenceReport
    const report = await prisma.conferenceReport.create({
      data: {
        conferenceId: id,
        summary,
        keyTakeaways: keyTakeaways ?? null,
        marketInsights: marketInsights ?? null,
        competitorSightings: competitorSightings ?? null,
        opportunities: opportunities ?? null,
        recommendations: recommendations ?? null,
        rating: rating ? parseInt(rating) : null,
        wikiPageId: wikiPage.id,
        submittedBy: userId,
      },
    })

    // Mark all attendees reportSubmitted = true
    await prisma.conferenceAttendee.updateMany({
      where: { conferenceId: id },
      data: { reportSubmitted: true },
    })

    // Create Interaction for all CRM-linked collected contacts
    for (const cc of conference.collectedContacts) {
      if (cc.contactId) {
        await prisma.activity.create({
          data: {
            contactId: cc.contactId,
            type: "conference",
            description: `Conference report submitted for ${conference.name}`,
            performedBy: userId,
          },
        })
      }
    }

    // Log activity
    logActivity(
      "conference_report_submitted",
      `Report submitted for ${conference.name}`,
      userId,
      conference.id,
      `/conferences/${conference.id}`,
    )

    // Send telegram to admins
    const admins = await prisma.employee.findMany({
      where: {
        roleLevel: { in: ["super_admin", "admin"] },
      },
      select: { id: true },
    })

    for (const admin of admins) {
      sendTelegramNotification(
        admin.id,
        `\uD83D\uDCCB Conference report submitted for *${conference.name}* by ${userId}.\nView: /conferences/${conference.id}`,
      )
    }

    return NextResponse.json({ report, wikiPage }, { status: 201 })
  } catch (error) {
    console.error("Failed to submit report:", error)
    return NextResponse.json({ error: "Failed to submit report" }, { status: 500 })
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { id } = await params

    const report = await prisma.conferenceReport.findUnique({
      where: { conferenceId: id },
    })

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 })
    }

    return NextResponse.json({ report })
  } catch (error) {
    console.error("Failed to fetch report:", error)
    return NextResponse.json({ error: "Failed to fetch report" }, { status: 500 })
  }
}
