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

    // If trimmed content is too short, the site is probably JS-rendered
    const contentTooShort = trimmedHtml.length < 200

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const msg = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: contentTooShort
            ? `I have a conference website URL: ${url}
The website content could not be fully loaded (likely JavaScript-rendered).
Based on the URL and any context you can infer, generate a helpful JSON response.
If you recognize this conference, provide real details. Otherwise, provide reasonable guesses based on the URL/domain.

Return ONLY valid JSON:
{
  "name": "Conference Name",
  "location": "City, Venue",
  "country": "Country",
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD",
  "description": "2-3 sentence summary describing what this conference is about, its focus area, and target audience",
  "ticketPrice": 0,
  "keyTopics": ["topic1", "topic2"],
  "expectedAttendees": 0,
  "speakers": ["Speaker Name 1"]
}`
            : `Extract conference information from this website content. Return ONLY valid JSON with these fields (include ALL fields, especially description — generate a helpful 2-3 sentence summary even if not explicitly stated on the page):
{
  "name": "Conference Name",
  "location": "City, Venue",
  "country": "Country",
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD",
  "description": "2-3 sentence summary of what the conference is about, its focus area, and who should attend",
  "ticketPrice": 0,
  "keyTopics": ["topic1", "topic2"],
  "expectedAttendees": 0,
  "speakers": ["Speaker Name 1"]
}

IMPORTANT: Always include a "description" field with a useful summary. Synthesize one from the available content.

Website URL: ${url}
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
