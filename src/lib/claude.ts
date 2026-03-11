import Anthropic from "@anthropic-ai/sdk"

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const SYSTEM_PROMPT = `You are an internal tool for Oxen Finance. Generate a single self-contained HTML file for meeting call notes.

DESIGN SYSTEM (mandatory):
- Background: #060709
- Cards: #0F1118 with border rgba(255,255,255,0.06)
- Rose gold accent: #C08B88 / #D4A5A2
- Text: #F0F0F2 (primary), rgba(240,240,242,0.55) (mid), rgba(240,240,242,0.3) (dim)
- Fonts: DM Sans (body) + Bellfair (page numbers) from Google Fonts
- All styles from the Oxen design system

STRUCTURE:
- Fixed sidebar (260px) with brand mark "O", date, and page navigation
- Multiple pages based on meeting topics (use the agenda to determine sections)
- Each page has: sticky header with page number (Bellfair) + title, cards with content, checklists with checkboxes, and a textarea for notes
- First page = Agenda overview with clickable tiles for each topic
- Last page = Summary & Action Items (decision textareas + action items textarea)
- Navigation: sidebar click, arrow buttons, keyboard arrows

INTERACTIVITY:
- Checkboxes: custom styled, rose gold when checked, strikethrough on label
- Textareas: dark input background, rose glow on focus
- Auto-save to localStorage with debounce (key: 'oxen-call-notes-[ID]')
- Toast notification "✓ Sauvegardé" on save
- Export All Notes button → markdown file download
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

export async function generateCallNotes(params: {
  title: string
  description?: string
  attendees?: string[]
  date: string
  context?: string
  noteId: string
}): Promise<string> {
  const userMessage = `Generate the HTML based on this meeting context:
- Title: ${params.title}
- Description: ${params.description || "No description provided"}
- Attendees: ${params.attendees?.join(", ") || "Not specified"}
- Date: ${params.date}
- Note ID: ${params.noteId}
- Additional context: ${params.context || "None"}`

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 16000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  })

  const textBlock = response.content.find((block) => block.type === "text")
  return textBlock?.text ?? ""
}
