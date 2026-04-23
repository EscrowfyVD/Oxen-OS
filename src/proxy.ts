import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function proxy(req: NextRequest) {
  // Generate request ID early — propagated via response header for correlation
  // with pino logger child (Sprint 2.4a). Reuses incoming id if client/proxy
  // already set one (e.g. Cloudflare).
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID()

  const { pathname } = req.nextUrl

  // Allow auth API routes, webhooks, login page, and static assets
  if (
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/telegram") ||
    pathname.startsWith("/api/webhooks") ||
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
