/**
 * Single source of truth for the Anthropic model ID used across the Next.js app.
 *
 * WHY THIS EXISTS: Anthropic retires model snapshots. A retired model does NOT
 * silently fall back — every `messages.create` returns `404 not_found_error`
 * ("model: <id>"). On 2026-06-15 `claude-sonnet-4-20250514` was retired, and
 * because the ID was hardcoded at ~30 call sites with no central constant, every
 * AI feature 404'd in prod for a month before anyone noticed (each caller swallows
 * the error and returns a fallback). Centralizing the ID here makes the next
 * deprecation a ONE-LINE change instead of a repo-wide sweep.
 *
 * The AI Worker is a separate package (workers/ai-worker) and cannot import from
 * `@/lib`; it keeps its own copy in workers/ai-worker/src/model.ts — keep the two
 * in sync when bumping the model.
 */
export const CLAUDE_MODEL = "claude-sonnet-4-6"
