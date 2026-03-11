import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(request: Request) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const limit = parseInt(searchParams.get("limit") ?? "20", 10)

  const activities = await prisma.activityLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  })

  return NextResponse.json({ activities })
}
