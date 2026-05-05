import { defineConfig } from "vitest/config"
import path from "node:path"

/**
 * Vitest configuration.
 *
 * Path alias `@/*` mirrors tsconfig.json so tests can import from
 * `@/lib/...` etc. — required for integration tests that exercise route
 * handlers (which themselves use `@/` imports).
 *
 * Created Sprint S0 batch 3 (Clay enrichment endpoint integration tests).
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
