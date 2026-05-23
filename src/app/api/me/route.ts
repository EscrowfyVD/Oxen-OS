import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isOnboardingConsoleEnabled } from "@/lib/onboarding/feature-flag"

/**
 * GET /api/me — Returns the current user's Employee record
 * Used for admin checks, personalization, calendar scoping, etc.
 *
 * Also returns `featureFlags` resolved server-side so the Sidebar
 * (a client component) can gate nav entries on flags that live in
 * server-only env vars — avoids leaking the flag name into the
 * client bundle via a NEXT_PUBLIC_ prefix (SP16-002).
 */
export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const email = session.user?.email
  const featureFlags = {
    onboardingConsole: isOnboardingConsoleEnabled(),
  }

  if (!email) return NextResponse.json({ employee: null, featureFlags })

  const employee = await prisma.employee.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
      entity: true,
      avatarColor: true,
      icon: true,
      initials: true,
      isAdmin: true,
      roleLevel: true,
      telegramChatId: true,
    },
  })

  return NextResponse.json({ employee, featureFlags })
}
