import { NextResponse } from "next/server"
import { CLAUDE_MODEL } from "@/lib/ai/model"
import { parseLlmJson } from "@/lib/ai/parse-llm-json"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import Anthropic from "@anthropic-ai/sdk"

const client = new Anthropic()

export async function POST() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const existingKeywords = await prisma.keyword.findMany({
    select: { keyword: true, vertical: true },
  })

  const existingList = existingKeywords
    .map((k) => `- "${k.keyword}" (${k.vertical})`)
    .join("\n")

  const prompt = `You are an SEO keyword research expert for Oxen Finance. Oxen Finance provides financial services across 7 verticals:

1. crypto - Crypto companies needing banking and payments
2. family_offices - Family offices and wealth management
3. csp - Corporate Service Providers and fiduciaries
4. luxury - Luxury asset brokers (art, real estate, etc.)
5. igaming - iGaming operators needing payment solutions
6. yachting - Yacht brokers and marine industry
7. trade_finance - Import/export companies and trade finance

Here are the keywords we already track:
${existingList}

Suggest 20 NEW keyword opportunities we should target. Focus on high-intent, commercially relevant keywords that potential clients would search for. Mix head terms and long-tail keywords across all verticals.

For each suggestion provide:
- keyword: the exact search term
- searchVolume: estimated monthly search volume (number)
- difficulty: estimated keyword difficulty 0-100 (number)
- vertical: which of the 7 verticals it belongs to
- reason: brief explanation of why this keyword is valuable

Return ONLY a valid JSON array of objects with these fields. No markdown, no code fences, just the JSON array.`

  const msg = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 4096, // Phase 2: raised from 1024 — a ~20-object keyword array truncates
    messages: [{ role: "user", content: prompt }],
  })

  let suggestions: Array<{
    keyword: string
    searchVolume: number
    difficulty: number
    vertical: string
    reason: string
  }> = []
  try {
    // Shared robust parser: throws on unusable output (truncation / malformed / no JSON)
    // instead of silently 500-ing on the fragile content[0] index.
    suggestions = parseLlmJson<Array<{
      keyword: string
      searchVolume: number
      difficulty: number
      vertical: string
      reason: string
    }>>(msg)
  } catch {
    return NextResponse.json(
      { error: "Failed to parse AI response" },
      { status: 500 }
    )
  }

  return NextResponse.json({ suggestions })
}
