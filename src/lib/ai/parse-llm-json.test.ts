/**
 * Tests for the single robust LLM JSON parser (Phase 2).
 * Covers: bare object/array, fence + prose tolerance, balanced/string-aware
 * extraction, content-block filter (not content[0]), truncation detection
 * (stop_reason + unclosed), and typed throws (never a fabricated default).
 */
import { describe, it, expect } from "vitest"
import { parseLlmJson } from "./parse-llm-json"
import { LlmOutputError, LlmTruncationError } from "./llm-alert"

const resp = (text: string, stop_reason: string | null = "end_turn") => ({
  stop_reason,
  content: [{ type: "text", text }],
})

describe("parseLlmJson", () => {
  it("[1] parses a bare JSON object", () => {
    expect(parseLlmJson(resp('{"a": 1, "b": "x"}'))).toEqual({ a: 1, b: "x" })
  })

  it("[2] parses a root JSON array", () => {
    expect(parseLlmJson(resp('[{"k": 1}, {"k": 2}]'))).toEqual([{ k: 1 }, { k: 2 }])
  })

  it("[3] ignores ```json fences (via balanced extraction, not a fragile strip)", () => {
    expect(parseLlmJson(resp('```json\n{"a": 1}\n```'))).toEqual({ a: 1 })
  })

  it("[4] ignores surrounding prose", () => {
    expect(parseLlmJson(resp('Here is the JSON:\n{"a": 1}\nHope that helps!'))).toEqual({ a: 1 })
  })

  it("[5] balanced + string-aware: braces inside strings and nested objects", () => {
    expect(parseLlmJson(resp('{"note": "a } b { c", "nested": {"x": [1,2]}}'))).toEqual({
      note: "a } b { c",
      nested: { x: [1, 2] },
    })
  })

  it("[6] uses the text block via type filter, NOT content[0] (non-text first block)", () => {
    const r = { stop_reason: "end_turn", content: [{ type: "thinking" }, { type: "text", text: '{"a": 1}' }] }
    expect(parseLlmJson(r)).toEqual({ a: 1 })
  })

  it("[7] TRUNCATION: stop_reason max_tokens → LlmTruncationError naming max_tokens", () => {
    let err: unknown
    try {
      parseLlmJson(resp('{"a": 1', "max_tokens"))
    } catch (e) {
      err = e
    }
    expect(err).toBeInstanceOf(LlmTruncationError)
    expect((err as Error).message).toMatch(/max_tokens/)
  })

  it("[8] TRUNCATION: unclosed JSON (cut off mid-object) → LlmTruncationError", () => {
    expect(() => parseLlmJson(resp('{"a": 1, "b": "unterminat'))).toThrow(LlmTruncationError)
  })

  it("[9] no JSON at all → LlmOutputError (never a fabricated default)", () => {
    expect(() => parseLlmJson(resp("I cannot help with that."))).toThrow(LlmOutputError)
  })

  it("[10] balanced but invalid JSON → LlmOutputError", () => {
    expect(() => parseLlmJson(resp("{'a': 1, bad}"))).toThrow(LlmOutputError)
  })

  it("[11] no text content → LlmOutputError", () => {
    expect(() => parseLlmJson({ stop_reason: "end_turn", content: [] })).toThrow(LlmOutputError)
  })

  it("[12] LlmTruncationError is an LlmOutputError (so isLlmFailure catches it)", () => {
    expect(new LlmTruncationError("x")).toBeInstanceOf(LlmOutputError)
  })
})
