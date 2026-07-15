/**
 * The single robust parser for LLM JSON output (Phase 2).
 *
 * Replaces the `parseJsonFromText` helper that was copy-pasted VERBATIM 5x plus ~12
 * ad-hoc greedy-regex / raw-JSON.parse parsers. ONE implementation, hardened:
 *   1. TRUNCATION FIRST — stop_reason === "max_tokens" throws LlmTruncationError, so
 *      the alert says "raise max_tokens" (truncation is the usual root cause of a
 *      parse-fail, not a bad prompt).
 *   2. Text from ALL text blocks via a type filter — never the fragile content[0] index.
 *   3. Balanced-brace extraction of the outermost {…} / […] — string-aware, so it
 *      ignores markdown fences + surrounding prose and does not lose the closing brace
 *      to a greedy regex (and detects an unclosed block = truncation).
 *   4. On any failure it THROWS a typed error (LlmOutputError / LlmTruncationError) —
 *      NEVER a fabricated default. Phase 0 already made call sites alert on the throw.
 *
 * The ai-worker is a separate package (no @/ alias) and mirrors this in
 * workers/ai-worker/src/lib/parse-llm-json.ts — keep the two in sync.
 */
import { LlmOutputError, LlmTruncationError } from "@/lib/ai/llm-alert"

/** Structural subset of an Anthropic Message — avoids coupling to an exact SDK type. */
export interface LlmResponse {
  stop_reason?: string | null
  content: Array<{ type: string; text?: string }>
}

/** Extract the outermost balanced {…} or […] block. String-aware (braces inside
 *  strings don't count). Throws if none is found, or LlmTruncationError if it opens
 *  but never closes (the response was cut off mid-JSON). */
function extractBalancedJson(text: string): string {
  let start = -1
  let open = ""
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === "{" || ch === "[") {
      start = i
      open = ch
      break
    }
  }
  if (start === -1) {
    throw new LlmOutputError("LLM output contained no JSON object or array")
  }
  const close = open === "{" ? "}" : "]"
  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (inString) {
      if (escaped) escaped = false
      else if (ch === "\\") escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') {
      inString = true
      continue
    }
    if (ch === open) depth++
    else if (ch === close) {
      depth--
      if (depth === 0) return text.slice(start, i + 1)
    }
  }
  // Opened but never balanced — the response was cut off mid-JSON.
  throw new LlmTruncationError(
    "LLM output JSON was never closed (likely truncated) — raise max_tokens",
  )
}

export function parseLlmJson<T = unknown>(response: LlmResponse): T {
  // 1. Truncation first — the #1 root cause of a parse failure, with a specific error.
  if (response.stop_reason === "max_tokens") {
    throw new LlmTruncationError(
      "LLM output was truncated (stop_reason=max_tokens) — raise max_tokens",
    )
  }
  // 2. Text from ALL text blocks (robust vs the fragile content[0] index).
  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("")
    .trim()
  if (!text) {
    throw new LlmOutputError("LLM response contained no text content")
  }
  // 3. Balanced extraction (ignores fences + prose; catches truncated/unbalanced).
  const block = extractBalancedJson(text)
  // 4. Parse — a bad parse THROWS, never a fabricated default.
  try {
    return JSON.parse(block) as T
  } catch (e) {
    throw new LlmOutputError(`LLM output was not valid JSON: ${(e as Error).message}`)
  }
}
