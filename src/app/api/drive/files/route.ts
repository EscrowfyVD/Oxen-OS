import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { listDriveFiles, getAccessTokenForUser } from "@/lib/google-drive"
import { prisma } from "@/lib/prisma"

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    console.log("[Drive] No session or email")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  console.log("[Drive] User email:", session.user.email)

  // Debug: check what scopes are stored
  const account = await prisma.account.findFirst({
    where: { provider: "google", user: { email: session.user.email } },
    select: { scope: true, access_token: true, refresh_token: true, expires_at: true },
  })
  console.log("[Drive] Stored scope:", account?.scope)
  console.log("[Drive] Has access_token:", !!account?.access_token)
  console.log("[Drive] Has refresh_token:", !!account?.refresh_token)
  console.log("[Drive] Token expires_at:", account?.expires_at, "now:", Math.floor(Date.now() / 1000))

  const hasDriveScope = account?.scope?.includes("drive")
  if (!hasDriveScope) {
    console.log("[Drive] WARNING: Stored token does NOT have drive scope. User needs to re-authenticate.")
    return NextResponse.json({
      error: "Drive scope not granted. Please sign out and sign back in to grant Google Drive access.",
      needsReauth: true,
    }, { status: 403 })
  }

  const accessToken = await getAccessTokenForUser(session.user.email)
  if (!accessToken) {
    console.log("[Drive] Failed to get access token")
    return NextResponse.json({ error: "No Drive access token" }, { status: 403 })
  }

  console.log("[Drive] Got access token, length:", accessToken.length)

  const { searchParams } = new URL(request.url)
  const folderId = searchParams.get("folderId") || undefined
  const query = searchParams.get("q") || undefined
  const pageToken = searchParams.get("pageToken") || undefined
  const starred = searchParams.get("starred") === "true"

  const result = await listDriveFiles(accessToken, { folderId, query, pageToken, starred })

  console.log("[Drive] Files returned:", result.files.length)

  return NextResponse.json(result)
}
