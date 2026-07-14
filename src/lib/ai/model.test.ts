/**
 * Guard test for the centralized Anthropic model ID (production-incident fix).
 *
 * WHY: On 2026-06-15 the pinned snapshot `claude-sonnet-4-20250514` was retired.
 * Because the string was hardcoded at ~32 call sites with no central constant,
 * every AI feature 404'd in prod for a month. This test enforces the invariant
 * that the model ID lives ONLY in the CLAUDE_MODEL constants — so the next
 * deprecation is a one-line change and can never silently scatter again.
 *
 * NOTE: unit tests mock the SDK, so a model-string change is invisible to them —
 * this class of bug (calling a non-existent model) is NOT caught by the normal
 * suite. This filesystem guard is the compensating control.
 */
import { describe, it, expect } from "vitest"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { CLAUDE_MODEL } from "./model"

const REPO_ROOT = process.cwd() // `vitest run` executes from the repo root
const RETIRED = "claude-sonnet-4-20250514"
// A hardcoded model literal passed to an SDK call, e.g. `model: "claude-..."`.
const HARDCODED_MODEL = /model:\s*["']claude-/

const SCAN_ROOTS = [
  join(REPO_ROOT, "src"),
  join(REPO_ROOT, "workers", "ai-worker", "src"),
]
// The two files allowed to name a model string: the constant definitions.
const ALLOWLIST = new Set(["model.ts", "model.test.ts"])

function walkTsFiles(dir: string): string[] {
  const out: string[] = []
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return out // root may not exist in some checkouts (e.g. worker excluded)
  }
  for (const entry of entries) {
    if (entry === "node_modules" || entry === "dist" || entry === ".next") continue
    const p = join(dir, entry)
    if (statSync(p).isDirectory()) out.push(...walkTsFiles(p))
    else if ((p.endsWith(".ts") || p.endsWith(".tsx")) && !p.endsWith(".test.ts") && !p.endsWith(".test.tsx"))
      out.push(p)
  }
  return out
}

const rel = (p: string) => p.replace(REPO_ROOT + "/", "")

describe("Anthropic model centralization (incident guard)", () => {
  it("[1] app CLAUDE_MODEL is the current, non-retired snapshot", () => {
    expect(CLAUDE_MODEL).toBe("claude-sonnet-4-6")
    expect(CLAUDE_MODEL).not.toBe(RETIRED)
  })

  it("[2] worker keeps its own copy in sync (separate package, no @/ alias)", () => {
    const workerModel = readFileSync(
      join(REPO_ROOT, "workers", "ai-worker", "src", "model.ts"),
      "utf8",
    )
    expect(workerModel).toContain('"claude-sonnet-4-6"')
    expect(workerModel).not.toContain(`"${RETIRED}"`)
  })

  it("[3] no source file hardcodes a model literal — all calls go through CLAUDE_MODEL", () => {
    const offenders: string[] = []
    for (const root of SCAN_ROOTS) {
      for (const file of walkTsFiles(root)) {
        if (ALLOWLIST.has(file.split("/").pop()!)) continue
        readFileSync(file, "utf8").split("\n").forEach((line, i) => {
          if (HARDCODED_MODEL.test(line)) offenders.push(`${rel(file)}:${i + 1}`)
        })
      }
    }
    expect(offenders, `hardcoded model literal(s) — route through CLAUDE_MODEL:\n${offenders.join("\n")}`).toEqual([])
  })

  it("[4] the retired snapshot appears in no code path", () => {
    const offenders: string[] = []
    for (const root of SCAN_ROOTS) {
      for (const file of walkTsFiles(root)) {
        if (ALLOWLIST.has(file.split("/").pop()!)) continue // model.ts names it only in a doc comment
        if (readFileSync(file, "utf8").includes(RETIRED)) offenders.push(rel(file))
      }
    }
    expect(offenders, `retired model string still present:\n${offenders.join("\n")}`).toEqual([])
  })
})
