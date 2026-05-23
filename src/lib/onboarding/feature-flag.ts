// Single source of truth for the Onboarding console feature flag.
//
// SP16-002 ships into a no-staging-branch Oxen OS — push to main = prod.
// The flag is read SERVER-SIDE only (no NEXT_PUBLIC_ prefix) so the
// browser bundle stays clean and the flag cannot be enabled by a
// crafted client. Three gating points all funnel through this helper:
//
//   1. `/onboarding/page.tsx` (RSC) — calls `notFound()` if false
//   2. `/onboarding/[id]/page.tsx` (RSC) — calls `notFound()` if false
//   3. `/api/oca/sessions[/[id]]/route.ts` — returns 404 if false
//
// The client-side Sidebar reads the resolved boolean via the extended
// `/api/me` response (a server endpoint that calls this helper), so
// the flag survives a Vercel/Railway env flip without a redeploy of
// any client bundle.
//
// Convention: `"true"` is the ONLY truthy value. Anything else
// (unset, "false", "1", "yes") = OFF. Matches how OCA gates
// OPERATOR_CONSOLE_ENABLED.

export function isOnboardingConsoleEnabled(): boolean {
  return process.env.ONBOARDING_CONSOLE_ENABLED === "true"
}
