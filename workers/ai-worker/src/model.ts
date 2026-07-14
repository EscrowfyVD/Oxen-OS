/**
 * Single source of truth for the Anthropic model ID used by the AI Worker.
 *
 * This worker is a SEPARATE package (oxen-os-ai-worker) with its own tsconfig and
 * no `@/lib` path alias, so it cannot import the app's src/lib/ai/model.ts. Keep
 * this value in sync with that file when bumping the model.
 *
 * A retired model snapshot returns `404 not_found_error` with no fallback — the
 * whole point of this constant is to make the next model bump a one-line change.
 */
export const CLAUDE_MODEL = "claude-sonnet-4-6"
