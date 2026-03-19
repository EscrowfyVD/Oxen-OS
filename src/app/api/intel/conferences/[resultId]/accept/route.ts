import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(request: Request, { params }: { params: Promise<{ resultId: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { resultId } = await params
  const body = await request.json()
  const { attendees } = body // string[]

  const result = await prisma.intelResult.findUnique({
    where: { id: resultId },
    include: { research: true },
  })
  if (!result) return NextResponse.json({ error: "Result not found" }, { status: 404 })

  const meta = (result.metadata as Record<string, unknown>) || {}
  const confName = result.title
  const confDates = (meta.dates as string) || ""
  const confLocation = (meta.location as string) || ""

  // Parse dates for calendar event
  let startTime = new Date()
  let endTime = new Date()
  if (confDates) {
    try {
      // Try to parse "March 15-17, 2026" or "2026-03-15" etc.
      const dateStr = confDates.split("-")[0].trim()
      const parsed = new Date(dateStr)
      if (!isNaN(parsed.getTime())) {
        startTime = parsed
        endTime = new Date(parsed.getTime() + 3 * 86400000) // Default 3 days
      }
    } catch { /* use defaults */ }
  }

  // Create internal event
  const event = await prisma.internalEvent.create({
    data: {
      title: `🎪 ${confName}`,
      description: `Conference: ${confName}\nLocation: ${confLocation}\nDates: ${confDates}\n\n${result.summary}`,
      startTime,
      endTime,
      location: confLocation,
      attendees: attendees || [],
      type: "conference",
      color: "#22C55E",
      createdBy: session.user?.email ?? "unknown",
    },
  })

  // Create wiki page stub
  const slug = confName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80)

  const existingPage = await prisma.wikiPage.findUnique({ where: { slug } })
  let wikiPage = null
  if (!existingPage) {
    wikiPage = await prisma.wikiPage.create({
      data: {
        title: `${confName} — ${confDates}`,
        slug,
        content: {
          type: "doc",
          content: [
            { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: confName }] },
            { type: "paragraph", content: [{ type: "text", text: `Location: ${confLocation}` }] },
            { type: "paragraph", content: [{ type: "text", text: `Dates: ${confDates}` }] },
            { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Why Attend" }] },
            { type: "paragraph", content: [{ type: "text", text: result.summary }] },
            { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Notes" }] },
            { type: "paragraph", content: [{ type: "text", text: "Add your notes here..." }] },
          ],
        },
        category: "Conferences",
        icon: "🎪",
        createdBy: session.user?.email ?? "unknown",
        updatedBy: session.user?.email ?? "unknown",
      },
    })
  }

  // Update result metadata
  await prisma.intelResult.update({
    where: { id: resultId },
    data: {
      metadata: {
        ...meta,
        accepted: true,
        attendees: attendees || [],
        eventId: event.id,
        wikiPageSlug: wikiPage?.slug || existingPage?.slug || slug,
      },
    },
  })

  return NextResponse.json({ success: true, eventId: event.id, wikiPageSlug: wikiPage?.slug || slug })
}
