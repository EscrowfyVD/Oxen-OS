/**
 * Next.js instrumentation hook — runs once on server startup.
 * Initialises Sentry for the Node.js runtime + the Edge runtime.
 *
 * See https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  if (!process.env.SENTRY_DSN) {
    // No DSN configured — Sentry disabled entirely (common in local dev)
    return
  }

  if (process.env.NEXT_RUNTIME === "nodejs") {
    const Sentry = await import("@sentry/nextjs")
    const { sentryBeforeSend } = await import("./lib/sentry")

    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV ?? "unknown",

      // No APM / profiling / replay — decision Q3 Sprint 2.4b
      tracesSampleRate: 0,

      // Strict PII policy
      sendDefaultPii: false,

      // Custom redaction on top of sendDefaultPii: false (defence in depth)
      beforeSend: sentryBeforeSend,

      // Drop integrations that either emit too much noise or risk PII:
      // - Console: pino already captures logs; avoid double-capture
      // - Http: automatic breadcrumbs from outbound HTTP can include bodies
      //   with secrets. We add breadcrumbs manually where needed.
      integrations: (defaultIntegrations) =>
        defaultIntegrations.filter(
          (i) => i.name !== "Console" && i.name !== "Http"
        ),

      // Default 100 is too generous for our signal/noise; 30 keeps recent ctx
      maxBreadcrumbs: 30,
    })
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    const Sentry = await import("@sentry/nextjs")
    const { sentryBeforeSend } = await import("./lib/sentry")

    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV ?? "unknown",
      tracesSampleRate: 0,
      sendDefaultPii: false,
      beforeSend: sentryBeforeSend,
      maxBreadcrumbs: 30,
    })
  }
}

/**
 * onRequestError: called for every unhandled error in route handlers and
 * server components. Forwards to Sentry.captureRequestError.
 *
 * See https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation#onrequesterror-optional
 */
export async function onRequestError(
  ...args: Parameters<typeof import("@sentry/nextjs").captureRequestError>
) {
  if (!process.env.SENTRY_DSN) return
  const Sentry = await import("@sentry/nextjs")
  Sentry.captureRequestError(...args)
}
