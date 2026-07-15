/**
 * Shared news-relevance scorer for the SEO news routes (auto-scan + scan).
 *
 * CONTRACT (post-incident hardening): an LLM/API failure THROWS — it does NOT
 * return a fake `score: 0`. The old inline versions swallowed the error into
 * `{ score: 0, status: 'irrelevant' }`, indistinguishable from a genuinely
 * irrelevant article — a lie that made a month-long model outage invisible
 * (NewsItem has no `reasoning` column, so even the "API call failed" marker was lost).
 * Callers MUST let the throw fail the request/job (visible + retryable) instead of
 * persisting a fabricated row.
 *
 * The parse-failure branch (model responded but not parseable JSON) is a separate
 * fragile-parser concern (explicitly out of scope for the hardening) and still
 * returns score 0 — noted, not fixed here.
 */
import type Anthropic from "@anthropic-ai/sdk"
import { CLAUDE_MODEL } from "@/lib/ai/model"

export interface NewsScore {
  score: number
  verticals: string[]
  reasoning: string
}

const PROMPT_HEAD = `Score this news article 0-100 on relevance to Oxen Finance's business. Oxen provides financial services to: crypto companies, family offices, CSPs/fiduciaries, luxury asset brokers, iGaming operators, yacht brokers, import/export companies. Score based on: does this news relate to banking, payments, financial services, regulation, or any of these verticals? Which verticals does it match? Return JSON only: {"score": number, "verticals": string[], "reasoning": string}`

export async function scoreNewsArticle(
  client: Anthropic,
  title: string,
  snippet: string,
): Promise<NewsScore> {
  const prompt = `${PROMPT_HEAD}\n\nTitle: ${title}\nSnippet: ${snippet?.substring(0, 500) || "No snippet available"}`

  // NO try/catch around the API call — an Anthropic APIError MUST propagate so the
  // caller fails visibly rather than writing a fabricated score.
  const msg = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  })

  const text = msg.content[0]?.type === "text" ? msg.content[0].text : ""
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    const parsed = JSON.parse(jsonMatch[0])
    return {
      score: parsed.score || 0,
      verticals: parsed.verticals || [],
      reasoning: parsed.reasoning || "",
    }
  }
  // Parser fragility (out of scope): model responded but no JSON object found.
  return { score: 0, verticals: [], reasoning: "Failed to parse response" }
}
