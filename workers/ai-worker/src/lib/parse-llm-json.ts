/**
 * Robust LLM JSON parser for the AI Worker — mirror of src/lib/ai/parse-llm-json.ts
 * (separate package, no @/ alias). Keep the two in sync.
 *
 * Truncation-first (stop_reason=max_tokens), text from ALL text blocks (not content[0]),
 * string-aware balanced-brace extraction, typed throws (LlmOutputError /
 * LlmTruncationError) — NEVER a fabricated default.
 */
import { LlmOutputError, LlmTruncationError } from "./llm-alert"

export interface LlmResponse {
  stop_reason?: string | null
  content: Array<{ type: string; text?: string }>
}

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
  throw new LlmTruncationError(
    "LLM output JSON was never closed (likely truncated) — raise max_tokens",
  )
}

export function parseLlmJson<T = unknown>(response: LlmResponse): T {
  if (response.stop_reason === "max_tokens") {
    throw new LlmTruncationError(
      "LLM output was truncated (stop_reason=max_tokens) — raise max_tokens",
    )
  }
  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("")
    .trim()
  if (!text) {
    throw new LlmOutputError("LLM response contained no text content")
  }
  const block = extractBalancedJson(text)
  try {
    return JSON.parse(block) as T
  } catch (e) {
    throw new LlmOutputError(`LLM output was not valid JSON: ${(e as Error).message}`)
  }
}
