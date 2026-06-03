import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { generateMeetingBrief } from "@/lib/ai/generate-meeting-brief"

// Thin HTTP entry point — auth + input parse, then delegate to the
// session-free generateMeetingBrief lib (shared with PR2's Cal.com webhook).
export async function POST(request: Request) {
  const session = await auth()
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const { eventId, contactId, meetingDate, title, attendees } = body

  if (!title || !meetingDate) {
    return NextResponse.json(
      { error: "title and meetingDate are required" },
      { status: 400 },
    )
  }

  try {
    const result = await generateMeetingBrief({
      eventId,
      contactId,
      meetingDate,
      title,
      attendees,
    })
    return NextResponse.json(result)
  } catch (error) {
    console.error("Brief generation error:", error)
    return NextResponse.json({ error: "Failed to generate brief" }, { status: 500 })
  }
}
