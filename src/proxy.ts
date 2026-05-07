import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function proxy(req: NextRequest) {
  // Generate request ID early — propagated via response header for correlation
  // with pino logger child (Sprint 2.4a). Reuses incoming id if client/proxy
  // already set one (e.g. Cloudflare).
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID()

  const { pathname } = req.nextUrl

  // Allow auth API routes, webhooks, login page, and static assets.
  //
  // /api/signals is also whitelisted (Sprint S1 batch 2 hotfix) — the
  // route handler at src/app/api/signals/route.ts authenticates via
  // bearer token (SIGNALS_INGESTION_SECRET) for server-to-server
  // integrations, with a session fallback for UI calls. Without this
  // bypass the middleware would 307-redirect bearer-only requests to
  // /login before the handler ever runs.
  //
  // /api/cron/* is whitelisted (Sprint Conference Brief) — these
  // endpoints authenticate via Bearer CRON_SECRET (same secret as the
  // existing /api/lemlist/sync cron path). Reached by Railway Cron
  // services without any user session.
  if (
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/telegram") ||
    pathname.startsWith("/api/webhooks") ||
    pathname.startsWith("/api/signals") ||
    pathname.startsWith("/api/cron") ||
    pathname === "/login" ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    const res = NextResponse.next()
    res.headers.set("x-request-id", requestId)
    return res
  }

  // Check for NextAuth session cookie (works in Edge Runtime without Prisma)
  const hasSession =
    req.cookies.has("authjs.session-token") ||
    req.cookies.has("__Secure-authjs.session-token") ||
    req.cookies.has("next-auth.session-token") ||
    req.cookies.has("__Secure-next-auth.session-token")

  if (!hasSession) {
    const loginUrl = new URL("/login", req.url)
    loginUrl.searchParams.set("callbackUrl", pathname)
    const redir = NextResponse.redirect(loginUrl)
    redir.headers.set("x-request-id", requestId)
    return redir
  }

  const res = NextResponse.next()
  res.headers.set("x-request-id", requestId)
  return res
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
