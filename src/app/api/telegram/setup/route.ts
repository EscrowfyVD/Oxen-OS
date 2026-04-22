import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { setWebhook } from "@/lib/telegram"

const WEBHOOK_URL = process.env.TELEGRAM_WEBHOOK_URL || "https://os.oxen.finance/api/telegram/webhook"

export async function POST() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const secret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!secret) {
    return NextResponse.json(
      { error: "TELEGRAM_WEBHOOK_SECRET must be configured" },
      { status: 500 }
    )
  }

  try {
    const result = await setWebhook(WEBHOOK_URL, secret)
    return NextResponse.json({ success: true, webhookUrl: WEBHOOK_URL, telegram: result })
  } catch (error) {
    console.error("Telegram setup error:", error)
    return NextResponse.json({ error: "Failed to set webhook" }, { status: 500 })
  }
}
