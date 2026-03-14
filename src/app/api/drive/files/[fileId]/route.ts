import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getDriveFile, getAccessTokenForUser } from "@/lib/google-drive"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const accessToken = await getAccessTokenForUser(session.user.email)
  if (!accessToken) {
    return NextResponse.json({ error: "No Drive access token" }, { status: 403 })
  }

  const { fileId } = await params
  const file = await getDriveFile(accessToken, fileId)

  if (!file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 })
  }

  return NextResponse.json({ file })
}
