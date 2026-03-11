import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Anthropic from "@anthropic-ai/sdk"

const SYSTEM_PROMPT = `You are an internal tool for Oxen Finance. Generate a single self-contained HTML file for meeting call notes.

COMPLETE CSS DESIGN SYSTEM (you MUST include all of this in the generated HTML):

\`\`\`css
:root {
  --bg: #0F1419;
  --bg-elevated: #141A20;
  --bg-card: #171E25;
  --bg-card-hover: #1C242C;
  --bg-input: #111820;
  --rose: #C08B88;
  --rose-light: #D4A5A2;
  --rose-dim: rgba(192,139,136,0.12);
  --rose-glow: rgba(192,139,136,0.06);
  --text: #E8E4E0;
  --text-dim: #6E7681;
  --text-mid: #9CA3AB;
  --border: rgba(192,139,136,0.10);
  --border-active: rgba(192,139,136,0.30);
  --green: #5CB868;
  --yellow: #E5C453;
  --blue: #5B9BBF;
  --purple: #9B7FD4;
  --orange: #D4885B;
  --teal: #5BB8A8;
  --nav-w: 260px;
}

* { margin:0; padding:0; box-sizing:border-box; }

body {
  font-family: 'DM Sans', sans-serif;
  background: var(--bg);
  color: var(--text);
  min-height: 100vh;
  display: flex;
}

/* SIDEBAR */
.sidebar {
  position: fixed;
  top: 0; left: 0; bottom: 0;
  width: var(--nav-w);
  background: var(--bg-elevated);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  z-index: 200;
}

.sidebar-brand {
  padding: 20px 22px;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  gap: 12px;
}

.sidebar-brand .logo {
  width: 38px; height: 38px;
  border-radius: 9px;
  background: linear-gradient(135deg, #C08B88, #D4A5A2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 18px;
  color: #0F1419;
}

.sidebar-brand .brand-text h1 { font-size: 14px; font-weight: 600; color: var(--text); }
.sidebar-brand .brand-text p { font-size: 11px; color: var(--text-dim); }

.sidebar-nav { padding: 12px 10px; flex: 1; overflow-y: auto; }

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 14px;
  margin-bottom: 2px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-mid);
  transition: all 0.15s ease;
  border: none;
  background: transparent;
  width: 100%;
  text-align: left;
  font-family: 'DM Sans', sans-serif;
}

.nav-item:hover { background: rgba(255,255,255,0.04); }

.nav-item.active {
  background: rgba(192,139,136,0.12);
  color: var(--rose);
  border-left: 3px solid var(--rose);
  border-radius: 0 8px 8px 0;
}

/* MAIN CONTENT */
.main {
  margin-left: var(--nav-w);
  flex: 1;
  padding: 0;
}

/* PAGE HEADER */
.page-header {
  position: sticky;
  top: 0;
  z-index: 100;
  background: rgba(15,20,25,0.88);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border-bottom: 1px solid var(--border);
  padding: 16px 32px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.page-header h2 { font-size: 18px; font-weight: 600; font-family: 'DM Sans', sans-serif; }
.page-header .page-num {
  font-family: 'Playfair Display', serif;
  font-size: 14px;
  color: var(--rose);
  font-weight: 600;
  margin-right: 10px;
}

/* CARDS */
.card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 12px;
  transition: border-color 0.2s;
  margin-bottom: 16px;
}

.card:hover { border-color: var(--border-active); }

.card-header {
  padding: 14px 20px;
  border-bottom: 1px solid rgba(255,255,255,0.03);
  background: rgba(192,139,136,0.02);
  border-radius: 12px 12px 0 0;
  font-size: 13px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
}

.card-body { padding: 16px 20px; }

/* HIGHLIGHT BOX */
.highlight-box {
  padding: 14px 18px;
  background: linear-gradient(135deg, rgba(192,139,136,0.06), transparent);
  border-left: 3px solid var(--rose);
  border-radius: 0 10px 10px 0;
  margin-bottom: 16px;
}

/* INPUTS & TEXTAREAS */
input[type="text"], textarea {
  width: 100%;
  padding: 10px 14px;
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: 10px;
  color: var(--text);
  font-size: 13px;
  font-family: 'DM Sans', sans-serif;
  transition: all 0.2s;
  resize: vertical;
}

input:focus, textarea:focus {
  outline: none;
  border-color: var(--rose);
  box-shadow: 0 0 0 3px rgba(192,139,136,0.08);
}

input::placeholder, textarea::placeholder {
  color: var(--text-dim);
  opacity: 0.5;
}

/* CHECKBOXES */
.checkbox-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 0;
}

.checkbox-row input[type="checkbox"] {
  appearance: none;
  width: 18px; height: 18px;
  border: 2px solid var(--border-active);
  border-radius: 5px;
  background: var(--bg-input);
  cursor: pointer;
  flex-shrink: 0;
  margin-top: 1px;
  transition: all 0.15s;
}

.checkbox-row input[type="checkbox"]:checked {
  background: linear-gradient(135deg, var(--rose), var(--rose-light));
  border-color: transparent;
}

.checkbox-row input[type="checkbox"]:checked::after {
  content: '\\2713';
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #0F1419;
  font-weight: 700;
}

.checkbox-row label { font-size: 13px; color: var(--text); cursor: pointer; line-height: 1.5; }
.checkbox-row input:checked + label { text-decoration: line-through; color: var(--text-dim); }

/* BUTTONS */
.btn-primary {
  background: linear-gradient(135deg, #C08B88, #D4A5A2);
  color: #0F1419;
  font-weight: 600;
  border: none;
  border-radius: 10px;
  padding: 10px 20px;
  cursor: pointer;
  font-family: 'DM Sans', sans-serif;
  font-size: 13px;
  transition: all 0.2s;
}

.btn-primary:hover { opacity: 0.9; transform: translateY(-1px); }

/* SECTION LABEL */
.section-label {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-dim);
}

/* ANIMATIONS */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.page-content { animation: fadeIn 0.3s ease; padding: 24px 32px; }

/* TOAST */
.toast {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 1000;
  padding: 12px 20px;
  background: var(--bg-card);
  border: 1px solid var(--border-active);
  border-radius: 10px;
  font-size: 13px;
  color: var(--green);
  animation: toastIn 0.3s ease;
}

@keyframes toastIn {
  from { opacity:0; transform: translateY(10px); }
  to { opacity:1; transform: translateY(0); }
}

/* SCROLLBAR */
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(192,139,136,0.2); border-radius: 3px; }

/* RESPONSIVE */
@media (max-width: 768px) {
  .sidebar { transform: translateX(-100%); transition: transform 0.3s; }
  .sidebar.open { transform: translateX(0); }
  .main { margin-left: 0; }
  .mobile-toggle { display: flex; }
}
\`\`\`

FONTS: Import both 'DM Sans' and 'Playfair Display' from Google Fonts.
- Playfair Display: page numbers, section numbers, large decorative numbers
- DM Sans: everything else

STRUCTURE:
- Fixed sidebar (260px) with brand mark "O" (square with border-radius 9px, gradient background, bold O), date info, and page navigation
- Multiple pages based on meeting topics (use the agenda to determine sections)
- Each page has: sticky header with page number (Playfair Display) + title, cards with content, checklists with custom checkboxes, and textareas for notes
- First page = Agenda overview with clickable tiles for each topic
- Last page = Summary & Action Items (decision textareas + action items textarea)
- Navigation: sidebar click, arrow buttons, keyboard arrows

INTERACTIVITY:
- Custom checkboxes: rose gold gradient when checked, checkmark icon, strikethrough on label
- Textareas: dark input background (#111820), rose glow on focus
- Auto-save to localStorage with 500ms debounce (key: 'oxen-call-notes-[ID]')
- Toast notification "\\u2713 Sauvegard\\u00e9" on save (slides up from bottom right)
- Export All Notes button \\u2192 markdown file download
- Mobile responsive with sidebar toggle

IMPORTANT: The HTML must include a postMessage bridge:
- When saving data: window.parent.postMessage({ type: 'SAVE_NOTE_DATA', data: savedData }, '*');
- On load, listen for: window.addEventListener('message', function(e) { if (e.data.type === 'LOAD_NOTE_DATA') { /* restore checkboxes and textareas from e.data.data */ } });

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
