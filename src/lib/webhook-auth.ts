import { NextResponse } from "next/server"
import { timingSafeEqual } from "crypto"

/**
 * Verify an incoming webhook request against a shared secret stored in an
 * environment variable.
 *
 * - Throws at *boot time* if the env var is not defined (fail-closed).
 * - Returns a 401 NextResponse if the header is missing or does not match.
 * - Returns null when the request is authentic (caller proceeds normally).
 */
export function requireWebhookSecret(
  req: Request,
  opts: { envVarName: string; headerName?: string },
): NextResponse | null {
  const secret = process.env[opts.envVarName]
  if (!secret) {
    throw new Error(
      `[webhook-auth] ${opts.envVarName} is not defined. ` +
        `Webhook cannot be verified — refusing to start.`,
    )
  }

  const header = req.headers.get(opts.headerName ?? "x-webhook-secret") ?? ""
  if (!header) {
    return NextResponse.json(
      { error: "Missing webhook secret" },
      { status: 401 },
    )
  }

  const a = Buffer.from(secret)
  const b = Buffer.from(header)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json(
      { error: "Invalid webhook secret" },
      { status: 401 },
    )
  }

  return null // authentic
}
