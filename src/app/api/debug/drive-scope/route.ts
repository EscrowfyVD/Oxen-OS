import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// Temporary debug endpoint — remove after Drive is working
export async function GET() {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 })
  }

  const accounts = await prisma.account.findMany({
    where: { user: { email: session.user.email } },
    select: {
      id: true,
      provider: true,
      scope: true,
      access_token: true,
      refresh_token: true,
      expires_at: true,
    },
  })

  return NextResponse.json({
    email: session.user.email,
    accounts: accounts.map((a) => ({
      id: a.id,
      provider: a.provider,
      scope: a.scope,
      hasAccessToken: !!a.access_token,
      hasRefreshToken: !!a.refresh_token,
      expiresAt: a.expires_at,
      now: Math.floor(Date.now() / 1000),
      hasDriveScope: a.scope?.includes("drive") ?? false,
    })),
  })
}

// POST to force-fix the scope
export async function POST() {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 })
  }

  const account = await prisma.account.findFirst({
    where: { provider: "google", user: { email: session.user.email } },
    select: { id: true, scope: true },
  })

  if (!account) {
    return NextResponse.json({ error: "No Google account found" }, { status: 404 })
  }

  const currentScope = account.scope || ""
  if (currentScope.includes("drive.readonly")) {
    return NextResponse.json({ message: "Scope already includes drive.readonly", scope: currentScope })
  }

  const newScope = currentScope
    ? `${currentScope} https://www.googleapis.com/auth/drive.readonly`
    : "openid email profile https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/drive.readonly"

  await prisma.account.update({
    where: { id: account.id },
    data: { scope: newScope },
  })

  return NextResponse.json({
    message: "Scope updated",
    oldScope: currentScope,
    newScope,
    note: "The access token still lacks drive permissions. You need to sign out and sign back in to get a new token with drive access.",
  })
}
