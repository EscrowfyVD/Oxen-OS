import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { listDriveFiles, getAccessTokenForUser } from "@/lib/google-drive"

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const accessToken = await getAccessTokenForUser(session.user.email)
  if (!accessToken) {
    return NextResponse.json({ error: "No Drive access token" }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const folderId = searchParams.get("folderId") || undefined
  const query = searchParams.get("q") || undefined
  const pageToken = searchParams.get("pageToken") || undefined
  const starred = searchParams.get("starred") === "true"

  const result = await listDriveFiles(accessToken, { folderId, query, pageToken, starred })

  return NextResponse.json(result)
}
