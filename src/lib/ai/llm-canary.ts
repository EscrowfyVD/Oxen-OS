/**
 * LLM canary — a real, minimal call to the ACTUAL model in use (CLAUDE_MODEL),
 * so the next model retirement/misconfig fails LOUDLY instead of silently.
 *
 * WHY: a mocked test suite is structurally blind to a retired model (933 green
 * tests while prod was dead for a month). A canary is the only thing that exercises
 * the real API on a schedule.
 *
 * DELIBERATE CHOICE: it calls CLAUDE_MODEL — NOT a cheaper proxy model. The entire
 * point is to detect THIS model's retirement; a haiku canary would stay green while
 * a retired sonnet killed prod. Cost is ~1 output token (max_tokens: 1), negligible.
 */
import Anthropic from "@anthropic-ai/sdk"
import { CLAUDE_MODEL } from "@/lib/ai/model"

export interface CanaryResult {
  ok: boolean
  model: string
  error?: string
}

export async function runLlmCanary(client?: Anthropic): Promise<CanaryResult> {
  const c = client ?? new Anthropic()
  try {
    await c.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1,
      messages: [{ role: "user", content: "ping" }],
    })
    return { ok: true, model: CLAUDE_MODEL }
  } catch (err) {
    return {
      ok: false,
      model: CLAUDE_MODEL,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
