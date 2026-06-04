// Tests for the Next.js middleware (renamed `proxy.ts` in Next 16+).
//
// Sprint S1 batch 2 hotfix — added these tests after a post-deploy
// bug where POST /api/signals 307-redirected to /login because the
// middleware enforced session cookie before the route handler could
// run its bearer-auth check. The hotfix added /api/signals to the
// whitelist; these tests pin that behavior so future whitelist edits
// don't accidentally re-introduce the bug.
//
// We exercise the `proxy()` function with minimal NextRequest mocks
// (only the fields it reads: headers.get, nextUrl.pathname,
// cookies.has, url). Casting through `unknown` to NextRequest keeps
// the test free of pulling in Next's full request fixtures.

import { describe, it, expect } from "vitest"
import type { NextRequest } from "next/server"
import { proxy } from "./proxy"

interface MockReqOpts {
  pathname: string
  hasSession?: boolean
  url?: string
  requestId?: string
}

function makeReq(opts: MockReqOpts): NextRequest {
  const url = opts.url ?? `https://os.oxen.finance${opts.pathname}`
  return {
    headers: {
      get: (name: string) =>
        name.toLowerCase() === "x-request-id"
          ? (opts.requestId ?? null)
          : null,
    },
    nextUrl: { pathname: opts.pathname },
    cookies: {
      has: (name: string) => {
        if (!opts.hasSession) return false
        // Match any of the 4 NextAuth cookie names the middleware checks
        return [
          "authjs.session-token",
          "__Secure-authjs.session-token",
          "next-auth.session-token",
          "__Secure-next-auth.session-token",
        ].includes(name)
      },
    },
    url,
  } as unknown as NextRequest
}

describe("proxy() — whitelist bypass (Sprint S1 batch 2 hotfix)", () => {
  it("/api/signals → bypass middleware (no redirect to /login)", async () => {
    // The bug scenario: bearer-only POST /api/signals (no session
    // cookie) was getting 307-redirected. After the hotfix it must
    // pass through (status 200 NextResponse.next()) so the route
    // handler can run its bearer check.
    const res = proxy(makeReq({ pathname: "/api/signals" }))
    // NextResponse.next() returns 200 with no Location header.
    expect(res.status).toBe(200)
    expect(res.headers.get("location")).toBeNull()
  })

  it("/api/signals/anything → bypass too (subpaths covered by startsWith)", async () => {
    // Defensive — even though we don't currently have subpaths under
    // /api/signals, the startsWith() check should cover them so a
    // future GET /api/signals/{id} or similar doesn't regress.
    const res = proxy(makeReq({ pathname: "/api/signals/health" }))
    expect(res.status).toBe(200)
  })

  it("/api/webhooks/lemcal → bypass (existing whitelist preserved)", async () => {
    // Regression check — the hotfix must not break the existing
    // /api/webhooks/* bypass which lemcal + lemlist + n8n + trigify rely on.
    const res = proxy(
      makeReq({ pathname: "/api/webhooks/lemcal" }),
    )
    expect(res.status).toBe(200)
  })

  it("/api/auth/callback → bypass (NextAuth callback)", async () => {
    const res = proxy(makeReq({ pathname: "/api/auth/callback/google" }))
    expect(res.status).toBe(200)
  })

  it("/login → bypass (login page itself must be reachable when logged out)", async () => {
    const res = proxy(makeReq({ pathname: "/login" }))
    expect(res.status).toBe(200)
  })

  it("/crm without session cookie → 307 redirect to /login (default-deny preserved)", async () => {
    // Critical regression check — the hotfix must NOT relax the
    // default-deny posture for non-API routes. /crm is a UI route
    // protected by the middleware.
    const res = proxy(makeReq({ pathname: "/crm" }))
    expect(res.status).toBe(307)
    const location = res.headers.get("location") ?? ""
    expect(location).toContain("/login")
    expect(location).toContain("callbackUrl=%2Fcrm")
  })

  it("/crm with session cookie → bypass (logged-in users reach UI)", async () => {
    const res = proxy(
      makeReq({ pathname: "/crm/contacts", hasSession: true }),
    )
    expect(res.status).toBe(200)
  })

  it("/api/crm/contacts without session → 307 redirect (UI-protected APIs still locked)", async () => {
    // /api/crm/* is intentionally session-only (UI calls). Bearer auth
    // is reserved for /api/signals + /api/webhooks/*. Verify that
    // API routes outside the whitelist still get redirected.
    const res = proxy(makeReq({ pathname: "/api/crm/contacts" }))
    expect(res.status).toBe(307)
  })

  it("propagates incoming x-request-id header on bypass", async () => {
    const res = proxy(
      makeReq({ pathname: "/api/signals", requestId: "trace-abc-123" }),
    )
    expect(res.headers.get("x-request-id")).toBe("trace-abc-123")
  })

  it("generates a fresh x-request-id when none provided", async () => {
    const res = proxy(makeReq({ pathname: "/api/signals" }))
    const id = res.headers.get("x-request-id")
    expect(id).toBeTruthy()
    expect(id).toMatch(/^[0-9a-f-]{36}$/i) // UUID v4 shape
  })
})
