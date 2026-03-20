import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import Anthropic from "@anthropic-ai/sdk"

export async function POST(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { url } = await request.json()
    if (!url) return NextResponse.json({ error: "URL required" }, { status: 400 })

    // Fetch the website
    let html = ""
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; OxenOS/1.0)",
          Accept: "text/html,application/xhtml+xml",
        },
        signal: AbortSignal.timeout(15000),
      })
      html = await res.text()
    } catch {
      return NextResponse.json({ error: "Could not fetch website" }, { status: 422 })
    }

    // Trim HTML to avoid token limits — take first 30k chars
    const trimmedHtml = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[\s\S]*?<\/nav>/gi, "")
      .replace(/<footer[\s\S]*?<\/footer>/gi, "")
      .replace(/<header[\s\S]*?<\/header>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 30000)

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const msg = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      messages: [
        {
          role: "user",
          content: `Extract conference information from this website content. Return ONLY valid JSON with these fields (omit any you cannot confidently extract):
{
  "name": "Conference Name",
  "location": "City, Venue",
  "country": "Country",
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD",
  "description": "2-3 sentence summary of what the conference is about",
  "ticketPrice": 0,
  "keyTopics": ["topic1", "topic2"],
  "expectedAttendees": 0,
  "speakers": ["Speaker Name 1"]
}

Website content:
${trimmedHtml}`,
        },
      ],
    })

    const text = msg.content[0]?.type === "text" ? msg.content[0].text : ""

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: "Could not extract data" }, { status: 422 })
    }

    const extracted = JSON.parse(jsonMatch[0])
    return NextResponse.json({ extracted })
  } catch (error) {
    console.error("Auto-fill error:", error)
    return NextResponse.json({ error: "Failed to auto-fill" }, { status: 500 })
  }
}
