// /onboarding/ — list view entry point (Server Component).
//
// The Server Component wrapper exists ONLY to enforce the
// ONBOARDING_CONSOLE_ENABLED flag gate before the client view
// renders. Reading process.env from a Server Component is safe
// (server-only) and the `notFound()` redirect makes the entire route
// invisible to users when the flag is off — including unauthenticated
// probes.
//
// The actual list UI is the client component (OnboardingList) —
// follows the Intent Feed template (use client + URL-sync filters +
// fetch loop + inline toast).

import { notFound } from "next/navigation"
import { isOnboardingConsoleEnabled } from "@/lib/onboarding/feature-flag"
import OnboardingList from "./_components/OnboardingList"

export default function OnboardingPage() {
  if (!isOnboardingConsoleEnabled()) {
    notFound()
  }
  return <OnboardingList />
}
