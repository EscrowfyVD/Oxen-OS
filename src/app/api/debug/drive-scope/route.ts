import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const session = await auth()

    if (!session?.user?.email) {
      return NextResponse.json({
        error: "Not logged in",
        tip: "Visit this URL while logged into the app",
      })
    }

    const account = await prisma.account.findFirst({
      where: {
        provider: "google",
        user: { email: session.user.email },
      },
    })

    if (!account) {
      return NextResponse.json({
        email: session.user.email,
        error: "No Google account record found in database",
      })
    }

    const scope = account.scope || "(empty)"
    return NextResponse.json({
      email: session.user.email,
      scope,
      hasDriveScope: scope.includes("drive"),
      hasCalendarScope: scope.includes("calendar"),
      hasGmailScope: scope.includes("gmail"),
      tokenExists: !!account.access_token,
      refreshTokenExists: !!account.refresh_token,
      expiresAt: account.expires_at,
      nowUnix: Math.floor(Date.now() / 1000),
      tokenExpired: account.expires_at ? account.expires_at < Math.floor(Date.now() / 1000) : "unknown",
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "Debug route crashed", message })
  }
}
