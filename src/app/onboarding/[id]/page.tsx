// /onboarding/[id]/ — detail view entry point (Server Component).
//
// Same flag-gate pattern as /onboarding/page.tsx — RSC checks
// ONBOARDING_CONSOLE_ENABLED, calls notFound() if off, otherwise
// renders the client detail component. id is awaited from the
// Next.js 16 async params signature and passed down explicitly.

import { notFound } from "next/navigation"
import { isOnboardingConsoleEnabled } from "@/lib/onboarding/feature-flag"
import OnboardingDetail from "../_components/OnboardingDetail"

export default async function OnboardingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  if (!isOnboardingConsoleEnabled()) {
    notFound()
  }
  const { id } = await params
  return <OnboardingDetail id={id} />
}
