import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { sendTelegramMessage } from "@/lib/telegram"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  const existing = await prisma.article.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 })
  }

  const article = await prisma.article.update({
    where: { id },
    data: {
      status: "published",
      publishedAt: new Date(),
    },
  })

  // Telegram notification placeholder
  try {
    const chatId = process.env.TELEGRAM_SEO_CHAT_ID
    if (chatId) {
      await sendTelegramMessage(
        chatId,
        `\ud83d\udcdd New article published: ${article.title}`
      )
    }
  } catch (err) {
    console.error("Telegram notification failed:", err)
  }

  return NextResponse.json({ article })
}
