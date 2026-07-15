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
 * Phase 0 (parse-hardening): unusable OUTPUT — no JSON object, malformed JSON, or a
 * missing numeric score — THROWS (LlmOutputError / SyntaxError), never a fabricated
 * score:0/irrelevant. Callers must let it fail the run (visible + retryable), the same
 * way a failed CALL does. "not evaluated" must never be recorded as "evaluated irrelevant".
 */
import type Anthropic from "@anthropic-ai/sdk"
import { CLAUDE_MODEL } from "@/lib/ai/model"
import { LlmOutputError } from "@/lib/ai/llm-alert"

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
  if (!jsonMatch) {
    // No JSON at all — NOT evaluated. Fail loudly; never fabricate score:0/irrelevant.
    throw new LlmOutputError("news scoring output had no JSON object")
  }
  const parsed = JSON.parse(jsonMatch[0]) // malformed JSON throws SyntaxError → also a loud failure
  if (typeof parsed.score !== "number") {
    throw new LlmOutputError("news scoring output missing a numeric score")
  }
  return {
    score: parsed.score,
    verticals: parsed.verticals || [],
    reasoning: parsed.reasoning || "",
  }
}
