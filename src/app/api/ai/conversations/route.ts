import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userId = session.user?.id ?? session.user?.email ?? "unknown"

  // Get the most recent conversation for this user
  const conversation = await prisma.aIConversation.findFirst({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  })

  return NextResponse.json({
    conversation: conversation
      ? { id: conversation.id, messages: conversation.messages }
      : null,
  })
}
