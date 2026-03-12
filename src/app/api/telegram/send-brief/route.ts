import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendTelegramMessage, formatBriefForTelegram } from "@/lib/telegram"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { meetingBriefId } = body

    if (!meetingBriefId) {
      return NextResponse.json({ error: "meetingBriefId is required" }, { status: 400 })
    }

    const brief = await prisma.meetingBrief.findUnique({
      where: { id: meetingBriefId },
    })

    if (!brief) {
      return NextResponse.json({ error: "Brief not found" }, { status: 404 })
    }

    // Find Oxen employees who are attendees AND have telegramChatId
    const sentTo: string[] = []
    const failed: string[] = []

    for (const attendee of brief.attendees) {
      // Match by email or name
      const employee = await prisma.employee.findFirst({
        where: {
          OR: [
            { email: { equals: attendee, mode: "insensitive" } },
            { name: { contains: attendee.split("@")[0], mode: "insensitive" } },
          ],
          telegramChatId: { not: null },
        },
        select: { id: true, name: true, telegramChatId: true },
      })

      if (!employee?.telegramChatId) continue

      const formatted = formatBriefForTelegram({
        title: brief.title,
        meetingDate: brief.meetingDate,
        attendees: brief.attendees,
        briefContent: brief.briefContent as Record<string, unknown>,
      })

      const result = await sendTelegramMessage(employee.telegramChatId, formatted)
      if (result.ok) {
        sentTo.push(employee.name)
      } else {
        failed.push(employee.name)
      }
    }

    // Update brief sentVia status
    if (sentTo.length > 0) {
      await prisma.meetingBrief.update({
        where: { id: meetingBriefId },
        data: { sentVia: `telegram:${sentTo.join(",")}` },
      })
    }

    return NextResponse.json({
      success: true,
      sentTo,
      failed,
      totalSent: sentTo.length,
    })
  } catch (error) {
    console.error("Send brief error:", error)
    return NextResponse.json({ error: "Failed to send brief" }, { status: 500 })
  }
}
