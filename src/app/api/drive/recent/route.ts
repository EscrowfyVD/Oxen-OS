import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { listDriveFiles, getAccessTokenForUser } from "@/lib/google-drive"

export async function GET() {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const accessToken = await getAccessTokenForUser(session.user.email)
  if (!accessToken) {
    return NextResponse.json({ error: "No Drive access token" }, { status: 403 })
  }

  const result = await listDriveFiles(accessToken, {
    pageSize: 30,
    orderBy: "viewedByMeTime desc",
  })

  return NextResponse.json(result)
}
