// /onboarding/ — list view entry point (Server Component).
//
// The Server Component wrapper exists ONLY to enforce the
// ONBOARDING_CONSOLE_ENABLED flag gate before the client view renders.
// Reading process.env from a Server Component is safe (server-only)
// and the `notFound()` redirect makes the entire route invisible to
// users when the flag is off — including unauthenticated probes.
//
// The actual list UI is the client component below — it follows the
// Intent Feed template (use client + URL-sync filters + fetch loop +
// inline toast). Slice 1 ships a minimal placeholder; Slice 3 replaces
// it with the full filterable list.

import { notFound } from "next/navigation"
import { isOnboardingConsoleEnabled } from "@/lib/onboarding/feature-flag"
import OnboardingListPlaceholder from "./_components/OnboardingListPlaceholder"

export default function OnboardingPage() {
  if (!isOnboardingConsoleEnabled()) {
    notFound()
  }
  return <OnboardingListPlaceholder />
}
