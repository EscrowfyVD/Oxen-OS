// Server-side proxy helper for the OCA operator API.
//
// SP16-002 ships read-only GET proxies under /api/oca/sessions[/[id]].
// SP16-003 adds 3 mutation routes (PATCH /agent, POST /messages,
// POST /reopen). All proxy routes share the same 7-gate contract;
// `proxyOcaJson` is the shared helper, with `proxyOcaGet` kept as a
// 1-line backward-compatible wrapper so SP16-002 callers stay
// untouched.
//
// Security contract (CRITICAL):
//   - OCA_OPERATOR_API_KEY is read from server-only env (no
//     NEXT_PUBLIC_ prefix). Next.js never inlines it in the client
//     bundle. The key never crosses the wire to the browser.
//   - x-operator-email is derived SERVER-SIDE from the NextAuth
//     session (`await auth()` via `requirePageAccess()`). The browser
//     CANNOT forge or override it — even if the inbound request
//     carries its own x-operator-email header, we ignore it and set
//     our own from the session. The OCA audit log attributes the
//     mutation to the real operator: `actor: "operator:<email>"`.
//   - The ONBOARDING_CONSOLE_ENABLED flag gates every proxy call
//     identically to the /onboarding/* pages: when off, the route
//     surface returns 404 (invisible to unauthenticated probes too).
//
// Error mapping policy:
//   - Upstream OCA 401 → 403 `{ error: "not_authorized" }` with a
//     recognizable message the UI can render as "your account is not
//     on OCA's OPERATOR_ALLOWLIST_EMAILS yet" (distinct from a
//     generic 500 so the user knows to ask Vernon, not retry).
//   - Upstream OCA 409 → 409 `{ error: "status_conflict" }` (SP16-003)
//     — only the reopen route triggers this, when called on a session
//     whose status is not `rejected`. Distinct from "OCA upstream
//     returned some 4xx" so the UI can refetch + drop the button
//     (the session status changed in another tab between render and
//     click).
//   - Network error / OCA unreachable → 502 `{ error: "oca_unreachable" }`.
//   - Any other non-2xx → pass-through with original status code.
//   - 2xx → pass-through body verbatim.

import { NextResponse } from "next/server"
import { requirePageAccess } from "@/lib/admin"
import { isOnboardingConsoleEnabled } from "@/lib/onboarding/feature-flag"
import { childLoggerFromRequest, serializeError } from "@/lib/logger"

export interface OcaProxyEnv {
  baseUrl: string
  apiKey: string
}

export type OcaMutationMethod = "PATCH" | "POST" | "PUT" | "DELETE"

/**
 * Read OCA env at call time (not module-init) so dev-server env
 * flips don't require a restart, and so tests can mutate
 * process.env before invoking the route handler.
 */
function readOcaEnv(): OcaProxyEnv | null {
  const baseUrl = process.env.OCA_API_BASE_URL ?? ""
  const apiKey = process.env.OCA_OPERATOR_API_KEY ?? ""
  if (!baseUrl || !apiKey) return null
  return { baseUrl, apiKey }
}

/**
 * Shared JSON-over-HTTP proxy helper. Both `proxyOcaGet` and
 * `proxyOcaMutation` are thin wrappers — this is where the 7 gates
 * live.
 *
 * @param method        — HTTP method to forward
 * @param request       — the inbound Next.js Request (used for logger context only)
 * @param upstreamPath  — the OCA path, e.g. "/api/admin/sessions/:id/agent"
 * @param opts.query    — optional URLSearchParams forwarded verbatim
 * @param opts.body     — optional JSON-serializable body (mutation methods only)
 */
export async function proxyOcaJson(
  method: "GET" | OcaMutationMethod,
  request: Request,
  upstreamPath: string,
  opts: {
    query?: URLSearchParams
    body?: unknown
  } = {},
): Promise<Response> {
  const log = childLoggerFromRequest(request).child({
    proxy: "oca",
    method,
    path: upstreamPath,
  })

  // 1. Flag gate — when off, the surface is invisible. 404 (not 503)
  //    so unauthenticated probes get the same response as users hitting
  //    a non-existent route — no signal that the module exists at all.
  if (!isOnboardingConsoleEnabled()) {
    return new NextResponse(null, { status: 404 })
  }

  // 2. Page access — must be a logged-in Oxen-OS user passing the
  //    `onboarding` rule. requirePageAccess returns a pre-built 401
  //    or 403 NextResponse; we forward verbatim.
  const access = await requirePageAccess("onboarding")
  if (access.error) return access.error

  // 3. Server-side email — NEVER trust the inbound request. We read
  //    the session that requirePageAccess just resolved.
  const operatorEmail = access.session?.user?.email
  if (!operatorEmail) {
    log.error("session has no email — cannot proxy without operator identity")
    return NextResponse.json(
      { error: "no_session_email" },
      { status: 403 },
    )
  }

  // 4. Env config — fail-closed if not configured.
  const env = readOcaEnv()
  if (!env) {
    log.error("OCA proxy env not configured (OCA_API_BASE_URL / OCA_OPERATOR_API_KEY)")
    return NextResponse.json(
      {
        error: "oca_not_configured",
        message: "OCA proxy is not configured on this Oxen-OS environment.",
      },
      { status: 500 },
    )
  }

  // 5. Build upstream URL.
  const qs =
    opts.query && opts.query.toString().length > 0
      ? `?${opts.query.toString()}`
      : ""
  const url = `${env.baseUrl}${upstreamPath}${qs}`

  // 6. Fetch + map errors.
  //    The "x-operator-email" header is derived SERVER-SIDE (above) —
  //    if the inbound request carries its own, it has already been
  //    discarded; we use the session's email.
  const headers: Record<string, string> = {
    "x-api-key": env.apiKey,
    "x-operator-email": operatorEmail,
  }
  let bodyInit: string | undefined
  if (opts.body !== undefined) {
    headers["content-type"] = "application/json"
    bodyInit = JSON.stringify(opts.body)
  }

  let upstream: Response
  try {
    upstream = await fetch(url, {
      method,
      headers,
      body: bodyInit,
      cache: "no-store",
    })
  } catch (err) {
    log.error({ err: serializeError(err) }, "OCA fetch threw — service unreachable")
    return NextResponse.json(
      {
        error: "oca_unreachable",
        message:
          "Could not reach the OCA operator API. The service may be deploying " +
          "or temporarily down — try again in a moment.",
      },
      { status: 502 },
    )
  }

  // 7a. Distinct allowlist-mismatch mapping (any method).
  if (upstream.status === 401) {
    log.warn(
      { operatorEmail },
      "OCA returned 401 — operator email not on OCA's OPERATOR_ALLOWLIST_EMAILS",
    )
    return NextResponse.json(
      {
        error: "not_authorized",
        message:
          "Your account is not yet authorized for the OCA operator console. " +
          "Contact Vernon to be added to OCA's OPERATOR_ALLOWLIST_EMAILS.",
      },
      { status: 403 },
    )
  }

  // 7b. Distinct status-conflict mapping for the reopen path. Any
  //     409 from OCA flows through here — today only `reopen` produces
  //     one (when status !== "rejected"); future endpoints emitting
  //     409 for unrelated reasons would also map cleanly, since the
  //     UI semantic ("the resource is not in the right state — refetch
  //     to find out") is the same.
  if (upstream.status === 409) {
    log.warn({ method, path: upstreamPath }, "OCA returned 409 — status conflict")
    const upstreamBody = await upstream.json().catch(() => null)
    return NextResponse.json(
      {
        error: "status_conflict",
        message:
          (upstreamBody && typeof upstreamBody === "object" && "message" in upstreamBody
            ? String(upstreamBody.message)
            : null) ??
          "The session is not in the right state for this action. " +
            "Refresh to see its current status.",
        upstream: upstreamBody,
      },
      { status: 409 },
    )
  }

  // 8. Pass-through (status + body). Body parse failures (e.g. OCA
  //    returns plain-text 500) fall through to null body.
  const body = await upstream.json().catch(() => null)
  return NextResponse.json(body, { status: upstream.status })
}

/**
 * Backward-compatible GET wrapper. SP16-002 routes call this and
 * stay unchanged. Internally delegates to proxyOcaJson.
 */
export async function proxyOcaGet(
  request: Request,
  upstreamPath: string,
  upstreamQuery?: URLSearchParams,
): Promise<Response> {
  return proxyOcaJson("GET", request, upstreamPath, { query: upstreamQuery })
}

/**
 * Mutation wrapper. SP16-003 routes call this with method + JSON body.
 * The body is forwarded as-is — callers are expected to have already
 * run their inbound body through a per-route Zod schema (the proxy
 * itself is shape-blind beyond requiring `unknown`).
 */
export async function proxyOcaMutation(
  method: OcaMutationMethod,
  request: Request,
  upstreamPath: string,
  body: unknown,
): Promise<Response> {
  return proxyOcaJson(method, request, upstreamPath, { body })
}
