import { readFileSync } from "node:fs"
import { createHash } from "node:crypto"
import { describe, it, expect } from "vitest"

/**
 * Coherence tests — the sync-worker has its own PrismaClient instance and
 * cannot cross-import from the Next.js src/ tree (separate Railway service,
 * separate tsconfig). We mirror token-encryption.ts and prisma.ts into
 * workers/sync-worker/src/lib/ via `npm run worker:sync-libs`.
 *
 * If these two copies diverge, tokens encrypted by one side will silently
 * fail to decrypt on the other. These tests hash both files and fail loudly
 * on any drift, so divergence is caught at PR time rather than at runtime.
 */

const PAIRS: ReadonlyArray<readonly [string, string]> = [
  [
    "src/lib/token-encryption.ts",
    "workers/sync-worker/src/lib/token-encryption.ts",
  ],
  ["src/lib/prisma.ts", "workers/sync-worker/src/lib/prisma.ts"],
  ["src/lib/logger.ts", "workers/sync-worker/src/lib/logger.ts"],
]

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex")
}

describe("worker lib sync", () => {
  for (const [src, worker] of PAIRS) {
    it(`${src} is identical to ${worker}`, () => {
      const srcHash = sha256(src)
      const workerHash = sha256(worker)
      expect(workerHash).toBe(srcHash)
    })
  }
})
