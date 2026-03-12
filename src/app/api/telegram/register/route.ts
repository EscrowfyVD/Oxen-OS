import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendTelegramMessage } from "@/lib/telegram"

/**
 * POST /api/telegram/register
 * Called internally (by webhook or manually) to link a Telegram chat to an Employee.
 *
 * Body: { chatId: number | string, email: string }
 *
 * Flow:
 * 1. User sends /start to @Oxen_deal_info_bot
 * 2. Bot replies asking for their @oxen.finance email
 * 3. User sends email → webhook calls this endpoint
 * 4. Matches email to Employee → saves telegramChatId
 * 5. Bot confirms the link
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { chatId, email } = body

    if (!chatId || !email) {
      return NextResponse.json(
        { error: "chatId and email are required" },
        { status: 400 },
      )
    }

    const chatIdStr = String(chatId)
    const emailClean = email.trim().toLowerCase()

    // Check if already linked
    const alreadyLinked = await prisma.employee.findFirst({
      where: { telegramChatId: chatIdStr },
      select: { id: true, name: true, email: true },
    })

    if (alreadyLinked) {
      await sendTelegramMessage(
        chatIdStr,
        `✅ Already linked to *${alreadyLinked.name}* (${alreadyLinked.email || "no email"}).`,
      )
      return NextResponse.json({
        success: true,
        alreadyLinked: true,
        employee: { id: alreadyLinked.id, name: alreadyLinked.name },
      })
    }

    // Match email to employee
    const employee = await prisma.employee.findFirst({
      where: { email: { equals: emailClean, mode: "insensitive" } },
      select: { id: true, name: true, email: true },
    })

    if (!employee) {
      await sendTelegramMessage(
        chatIdStr,
        `❌ No employee found with email "${emailClean}".\nPlease check and send your @oxen.finance email again.`,
      )
      return NextResponse.json(
        { error: "Employee not found", email: emailClean },
        { status: 404 },
      )
    }

    // Save telegramChatId
    await prisma.employee.update({
      where: { id: employee.id },
      data: { telegramChatId: chatIdStr },
    })

    // Confirm via Telegram
    await sendTelegramMessage(
      chatIdStr,
      `✅ Linked to *${employee.name}*. You'll receive meeting briefs and notifications here.\n\nCommands:\n/brief — Next meeting brief\n/digest — Daily digest\n/myid — Your chat ID`,
    )

    return NextResponse.json({
      success: true,
      employee: { id: employee.id, name: employee.name },
    })
  } catch (error) {
    console.error("Telegram register error:", error)
    return NextResponse.json(
      { error: "Failed to register Telegram" },
      { status: 500 },
    )
  }
}
