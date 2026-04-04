import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { sendTelegramMessage } from "@/lib/telegram"

export async function POST() {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const now = new Date()

  // Find articles scheduled for publishing that are still in draft or in_review
  const articles = await prisma.article.findMany({
    where: {
      scheduledFor: { lte: now },
      status: { in: ["draft", "in_review"] },
      NOT: { scheduledFor: null },
    },
  })

  const publishedTitles: string[] = []

  for (const article of articles) {
    await prisma.article.update({
      where: { id: article.id },
      data: {
        status: "published",
        publishedAt: now,
      },
    })

    publishedTitles.push(article.title)

    // Send Telegram notification
    try {
      const chatId = process.env.TELEGRAM_SEO_CHAT_ID
      if (chatId) {
        await sendTelegramMessage(
          chatId,
          `\ud83d\udcdd New article published: ${article.title}`
        )
      }
    } catch (err) {
      console.error(`Telegram notification failed for "${article.title}":`, err)
    }
  }

  return NextResponse.json({
    published: publishedTitles.length,
    titles: publishedTitles,
  })
}
