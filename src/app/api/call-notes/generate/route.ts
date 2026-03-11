import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
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

Generate the HTML based on this meeting context:`

export async function POST(request: Request) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { title, description, attendees, date, context } = body

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
    attendees ? `Attendees: ${Array.isArray(attendees) ? attendees.join(", ") : attendees}` : null,
    context ? `Additional Context: ${context}` : null,
  ]
    .filter(Boolean)
    .join("\n")

  const client = new Anthropic()

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 16000,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: userMessage,
      },
    ],
  })

  // Extract the text content from the response
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

  return NextResponse.json({ htmlContent })
}
