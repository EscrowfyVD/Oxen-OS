/**
 * Browser-side Sentry init.
 *
 * Scope: captures uncaught errors and unhandled promise rejections
 * originating in the browser (React client components, hooks, event handlers).
 *
 * Strict PII policy: no default PII, no replays, no tracing.
 */

import * as Sentry from "@sentry/nextjs"
import { sentryBeforeSend } from "./lib/sentry"

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NODE_ENV ?? "unknown",

    // All performance/replay features disabled
    tracesSampleRate: 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,

    sendDefaultPii: false,
    beforeSend: sentryBeforeSend,

    // Disable integrations that capture too much (console, xhr/fetch bodies)
    integrations: (defaultIntegrations) =>
      defaultIntegrations.filter(
        (i) => i.name !== "Console" && i.name !== "BrowserTracing"
      ),

    maxBreadcrumbs: 30,
  })
}
