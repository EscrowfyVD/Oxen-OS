import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Anthropic from "@anthropic-ai/sdk"

const SYSTEM_PROMPT = `You are an internal tool for Oxen Finance. Generate a single self-contained HTML file for meeting call notes.

DESIGN SYSTEM (mandatory):
- Background: #0F1419
- Cards: #171E25 with border rgba(192,139,136,0.10)
- Rose gold accent: #C08B88 / #D4A5A2
- Text: #E8E4E0 (primary), #9CA3AB (mid), #6E7681 (dim)
- Fonts: DM Sans (body) + Playfair Display (page numbers) from Google Fonts
- All styles from the Oxen design system

STRUCTURE:
- Fixed sidebar (260px) with brand mark "O", date, and page navigation
- Multiple pages based on meeting topics (use the agenda to determine sections)
- Each page has: sticky header with page number + title, cards with content, checklists with checkboxes, and a textarea for notes
- First page = Agenda overview with clickable tiles for each topic
- Last page = Summary & Action Items (decision textareas + action items textarea)
- Navigation: sidebar click, arrow buttons, keyboard arrows

INTERACTIVITY:
- Checkboxes: custom styled, rose gold when checked, strikethrough on label
- Textareas: dark input background, rose glow on focus
- Auto-save to localStorage with debounce (key: 'oxen-call-notes-[ID]')
- Toast notification "\u2713 Sauvegard\u00e9" on save
- Export All Notes button \u2192 markdown file download
- Mobile responsive with sidebar toggle

IMPORTANT: The HTML must include a postMessage bridge. When saving data, also post a message to the parent window:
window.parent.postMessage({ type: 'SAVE_NOTE_DATA', data: savedData }, '*');

When the page loads, listen for messages from the parent:
window.addEventListener('message', function(e) {
  if (e.data.type === 'LOAD_NOTE_DATA') {
    // restore checkboxes and textareas from e.data.data
  }
});

Produce ONLY the HTML file content, no explanation.`

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  let { title, description, attendees, date, context, eventId } = body

  // If eventId is provided, look up the calendar event for details
  if (eventId && !title) {
    const event = await prisma.calendarEvent.findUnique({
      where: { id: eventId },
    })
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }
    title = event.title
    description = description || event.description
    attendees = attendees || event.attendees
    date = date || event.startTime.toISOString()
  }

  if (!title) {
    return NextResponse.json(
      { error: "Missing required field: title" },
      { status: 400 }
    )
  }

  const userMessage = [
    `Meeting Title: ${title}`,
    date ? `Date: ${date}` : null,
    description ? `Description: ${description}` : null,
    attendees
      ? `Attendees: ${Array.isArray(attendees) ? attendees.join(", ") : attendees}`
      : null,
    context ? `Additional Context: ${context}` : null,
  ]
    .filter(Boolean)
    .join("\n")

  try {
    const client = new Anthropic()

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    })

    const textBlock = message.content.find((block) => block.type === "text")
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json(
        { error: "Failed to generate call notes" },
        { status: 500 }
      )
    }

    let htmlContent = textBlock.text

    // If the response wraps the HTML in a code block, extract it
    const htmlMatch = htmlContent.match(/```html\n?([\s\S]*?)```/)
    if (htmlMatch) {
      htmlContent = htmlMatch[1].trim()
    }

    // Auto-create a CallNote record if eventId was provided
    if (eventId) {
      const callNote = await prisma.callNote.create({
        data: {
          title,
          date: date ? new Date(date) : new Date(),
          htmlContent,
          eventId,
          createdBy: session.user.email ?? session.user.id ?? "unknown",
        },
      })

      // Log activity
      await prisma.activityLog.create({
        data: {
          action: "callnote_generated",
          detail: `Call notes generated for "${title}"`,
          userId: session.user.id ?? "unknown",
        },
      })

      return NextResponse.json({ htmlContent, callNoteId: callNote.id })
    }

    return NextResponse.json({ htmlContent })
  } catch (error) {
    console.error("Call note generation error:", error)
    return NextResponse.json(
      { error: "Failed to generate call notes. Check your Anthropic API key." },
      { status: 500 }
    )
  }
}
