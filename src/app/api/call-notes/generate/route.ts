import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { prisma } from "@/lib/prisma"
import Anthropic from "@anthropic-ai/sdk"

const SYSTEM_PROMPT = `You are an internal tool for Oxen Finance. Generate a single self-contained HTML file for meeting call notes.

COMPLETE CSS DESIGN SYSTEM (you MUST include all of this in the generated HTML):

\`\`\`css
:root {
  --bg: #060709;
  --bg-elevated: #0D0F14;
  --bg-card: #0F1118;
  --bg-card-hover: #141620;
  --bg-input: #0A0C10;
  --rose: #C08B88;
  --rose-light: #D4A5A2;
  --rose-dim: rgba(192,139,136,0.12);
  --rose-glow: rgba(192,139,136,0.06);
  --text: #F0F0F2;
  --text-dim: rgba(240,240,242,0.3);
  --text-mid: rgba(240,240,242,0.55);
  --border: rgba(255,255,255,0.06);
  --border-active: rgba(192,139,136,0.30);
  --green: #34D399;
  --yellow: #FBBF24;
  --blue: #818CF8;
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

body::before { content:''; position:fixed; top:-50%; left:-50%; width:200%; height:200%; background:radial-gradient(ellipse at 20% 20%, rgba(192,139,136,0.04) 0%, transparent 50%); pointer-events:none; z-index:0; }

.sidebar { position:fixed; top:0; left:0; bottom:0; width:var(--nav-w); background:var(--bg-elevated); border-right:1px solid var(--border); display:flex; flex-direction:column; z-index:200; }
.sidebar-brand { padding:20px 22px; border-bottom:1px solid var(--border); display:flex; align-items:center; gap:12px; }
.sidebar-brand .logo { width:38px; height:38px; border-radius:9px; background:linear-gradient(135deg,#C08B88,#D4A5A2); display:flex; align-items:center; justify-content:center; font-weight:700; font-size:18px; color:#060709; }
.sidebar-brand .brand-text h1 { font-size:14px; font-weight:600; color:var(--text); }
.sidebar-brand .brand-text p { font-size:11px; color:var(--text-dim); }
.sidebar-nav { padding:12px 10px; flex:1; overflow-y:auto; }
.nav-item { display:flex; align-items:center; gap:10px; padding:9px 14px; margin-bottom:2px; border-radius:8px; cursor:pointer; font-size:13px; color:var(--text-mid); transition:all 0.15s ease; border:none; background:transparent; width:100%; text-align:left; font-family:'DM Sans',sans-serif; }
.nav-item:hover { background:rgba(255,255,255,0.04); }
.nav-item.active { background:rgba(192,139,136,0.12); color:var(--rose); border-left:3px solid var(--rose); border-radius:0 8px 8px 0; }
.nav-badge { font-size:10px; background:rgba(192,139,136,0.15); color:var(--rose); padding:2px 8px; border-radius:10px; margin-left:auto; }

.main { margin-left:var(--nav-w); flex:1; padding:0; }
.page-header { position:sticky; top:0; z-index:100; background:rgba(6,7,9,0.88); backdrop-filter:blur(24px); -webkit-backdrop-filter:blur(24px); border-bottom:1px solid var(--border); padding:16px 32px; display:flex; align-items:center; justify-content:space-between; }
.page-header h2 { font-size:18px; font-weight:600; font-family:'DM Sans',sans-serif; }
.page-header .page-num { font-family:'Bellfair',serif; font-size:14px; color:var(--rose); font-weight:400; margin-right:10px; }

.card { position:relative; background:var(--bg-card); border:1px solid var(--border); border-radius:12px; transition:all 0.2s; margin-bottom:16px; }
.card::after { content:''; position:absolute; top:0; left:0; right:0; height:1px; background:linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent); }
.card:hover { border-color:var(--border-active); transform:translateY(-1px); box-shadow:0 8px 32px rgba(0,0,0,0.3); }
.card-header { padding:14px 20px; border-bottom:1px solid rgba(255,255,255,0.03); background:rgba(192,139,136,0.02); border-radius:12px 12px 0 0; font-size:13px; font-weight:600; display:flex; align-items:center; gap:8px; }
.card-body { padding:16px 20px; }

.highlight-box { padding:14px 18px; background:linear-gradient(135deg, rgba(192,139,136,0.06), transparent); border-left:3px solid var(--rose); border-radius:0 10px 10px 0; margin-bottom:16px; }

input[type="text"], textarea { width:100%; padding:10px 14px; background:var(--bg-input); border:1px solid var(--border); border-radius:10px; color:var(--text); font-size:13px; font-family:'DM Sans',sans-serif; transition:all 0.2s; resize:vertical; }
input:focus, textarea:focus { outline:none; border-color:var(--rose); box-shadow:0 0 0 3px rgba(192,139,136,0.08); }
input::placeholder, textarea::placeholder { color:var(--text-dim); opacity:0.5; }

.checkbox-row { display:flex; align-items:flex-start; gap:10px; padding:8px 0; }
.checkbox-row input[type="checkbox"] { appearance:none; width:18px; height:18px; border:2px solid var(--border-active); border-radius:5px; background:var(--bg-input); cursor:pointer; flex-shrink:0; margin-top:1px; transition:all 0.15s; }
.checkbox-row input[type="checkbox"]:checked { background:linear-gradient(135deg, var(--rose), var(--rose-light)); border-color:transparent; }
.checkbox-row input[type="checkbox"]:checked::after { content:'\\2713'; display:flex; align-items:center; justify-content:center; font-size:12px; color:#060709; font-weight:700; }
.checkbox-row label { font-size:13px; color:var(--text); cursor:pointer; line-height:1.5; }
.checkbox-row input:checked + label { text-decoration:line-through; color:var(--text-dim); }

.btn-primary { background:linear-gradient(135deg,#C08B88,#D4A5A2); color:#060709; font-weight:600; border:none; border-radius:10px; padding:10px 20px; cursor:pointer; font-family:'DM Sans',sans-serif; font-size:13px; transition:all 0.2s; }
.btn-primary:hover { opacity:0.9; transform:translateY(-1px); }
.section-label { font-size:10px; font-weight:600; letter-spacing:0.1em; text-transform:uppercase; color:var(--text-dim); }

@keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
.page-content { animation:fadeIn 0.3s ease; padding:24px 32px; }

.toast { position:fixed; bottom:24px; right:24px; z-index:1000; padding:12px 20px; background:var(--bg-card); border:1px solid var(--border-active); border-radius:10px; font-size:13px; color:var(--green); animation:toastIn 0.3s ease; }
@keyframes toastIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }

::-webkit-scrollbar { width:6px; }
::-webkit-scrollbar-track { background:transparent; }
::-webkit-scrollbar-thumb { background:rgba(192,139,136,0.2); border-radius:3px; }

@media (max-width:860px) {
  .sidebar { transform:translateX(-100%); transition:transform 0.3s; }
  .sidebar.open { transform:translateX(0); }
  .main { margin-left:0; }
  .mobile-toggle { display:flex !important; }
}
\`\`\`

FONTS: Import both 'DM Sans' and 'Bellfair' from Google Fonts.
- Bellfair: page numbers, section numbers, large decorative numbers
- DM Sans: everything else

PAGE STRUCTURE RULES:
1. Analyze the AGENDA to determine the number of topic pages. Each major agenda item becomes its own page.
2. Page 1 is ALWAYS the Agenda Overview page with clickable tiles for each topic (colored top border, number, icon, title, subtitle).
3. Pages 2 through N are the topic pages derived from the agenda items.
4. The LAST page is ALWAYS the Summary & Action Items page.
5. Total pages = 1 (Agenda) + N (topics from agenda) + 1 (Summary).

SIDEBAR (fixed, 260px):
- Brand mark "O" (square with border-radius 9px, rose-gold gradient background, bold O character)
- Meeting title below the brand
- Date of the meeting displayed below the title
- Page navigation: each page as a nav-item button with emoji icon + page badge number
- "Summary & Actions" as the last nav item
- "Export All Notes" button in the sidebar footer

AGENDA PAGE (first page):
- Highlight box with key context from the prep work provided
- Grid of clickable tiles — one per agenda topic, each with colored top border, number in Bellfair font at 0.3 opacity, emoji icon, title, and subtitle
- General notes textarea at the bottom

TOPIC PAGES (one per agenda item):
- Sticky header with page number (Bellfair 28px, rose at 0.3 opacity) + title + subtitle
- Highlight box with relevant context/prep work for that specific topic
- Cards with discussion points and relevant data
- Checklists with items to validate (generate these from the "Key Questions" input when relevant to this topic)
- Textarea for notes during discussion
- Previous decisions shown as reference cards if the "Previous Decisions" input is relevant to this topic

SUMMARY PAGE (last page):
- Decision textareas grouped by topic
- Action Items textarea with placeholder: "\\u2022 [Responsable] \\u2014 [Action] \\u2014 [Deadline]"
- Next Steps textarea
- Free notes textarea

INTERACTIVITY (all must be included):
- Custom checkboxes: rose gold gradient when checked, checkmark icon, strikethrough on label
- Textareas: dark input background (#0A0C10), rose glow on focus (box-shadow: 0 0 0 3px rgba(192,139,136,0.08))
- Auto-save with 600ms debounce \\u2014 saves both textarea values and checkbox states
- Toast notification "\\u2713 Saved" on save (green text, slides up from bottom right)
- Export All Notes button \\u2192 markdown file download with all textarea content and checklist status
- Navigation: sidebar click, arrow buttons in page header, keyboard left/right arrows
- Mobile responsive: sidebar collapses at 860px with hamburger toggle
- Page transition: fadeIn 0.3s ease (opacity 0 translateY 8px \\u2192 opacity 1 translateY 0)

POSTMESSAGE BRIDGE (CRITICAL \\u2014 include in JavaScript):
The HTML will be embedded in an iframe. The PRIMARY persistence mechanism is postMessage, NOT localStorage.
1. On DOMContentLoaded, immediately send: window.parent.postMessage({ type: 'NOTES_READY' }, '*');
2. On every auto-save (after 600ms debounce), send: window.parent.postMessage({ type: 'SAVE_NOTE_DATA', data: collectedData }, '*');
   where collectedData is an object mapping element IDs to their values (textarea values and checkbox checked states).
3. Listen for incoming data: window.addEventListener('message', function(e) {
     if (e.data && e.data.type === 'LOAD_NOTE_DATA') { /* restore all textarea values and checkbox checked states from e.data.data */ }
   });
4. Also keep localStorage as a FALLBACK for standalone use (key: 'oxen-call-notes').

Produce ONLY the complete HTML file content. No explanation, no markdown wrapping, no code fences.`

export async function POST(request: Request) {
  const { error, session } = await requireAdmin()
  if (error) return error

  const body = await request.json()
  let { title, description, attendees, date, context, eventId, agenda, questions, participants, previousDecisions } = body

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

  if (!agenda) {
    return NextResponse.json(
      { error: "Missing required field: agenda" },
      { status: 400 }
    )
  }

  const userMessage = [
    `Generate structured call notes for this meeting:`,
    ``,
    `Title: ${title}`,
    date ? `Date: ${date}` : null,
    attendees
      ? `Attendees: ${Array.isArray(attendees) ? attendees.join(", ") : attendees}`
      : null,
    description ? `Description: ${description}` : null,
    ``,
    `--- AGENDA ---`,
    agenda,
    context ? `\n--- CONTEXT & PREP WORK ---\n${context}` : null,
    questions ? `\n--- KEY QUESTIONS TO VALIDATE ---\n${questions}` : null,
    participants ? `\n--- PARTICIPANTS & ROLES ---\n${participants}` : null,
    previousDecisions ? `\n--- PREVIOUS DECISIONS / FOLLOW-UPS ---\n${previousDecisions}` : null,
    ``,
    `Generate a complete interactive HTML page with all sections, checklists, and note areas. Each agenda item should become its own page.`,
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

    // Always create a CallNote record
    const callNote = await prisma.callNote.create({
      data: {
        title,
        date: date ? new Date(date) : new Date(),
        htmlContent,
        eventId: eventId || null,
        createdBy: session!.user?.email ?? session!.user?.id ?? "unknown",
      },
    })

    // Log activity
    try {
      await prisma.activityLog.create({
        data: {
          action: "callnote_generated",
          detail: `Call notes generated for "${title}"`,
          userId: session!.user?.id ?? "unknown",
        },
      })
    } catch {
      // ActivityLog might not exist, ignore
    }

    return NextResponse.json({ htmlContent, callNoteId: callNote.id })
  } catch (err) {
    console.error("Call note generation error:", err)
    return NextResponse.json(
      { error: "Failed to generate call notes. Check your Anthropic API key." },
      { status: 500 }
    )
  }
}
