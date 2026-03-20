import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { sendTelegramNotification } from "@/lib/telegram"

export async function POST() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const overdueConferences = await prisma.conference.findMany({
      where: {
        status: "completed",
        endDate: { lt: sevenDaysAgo },
        report: null,
      },
      include: {
        attendees: {
          select: { employeeId: true },
        },
      },
    })

    let notificationsSent = 0

    for (const conference of overdueConferences) {
      for (const attendee of conference.attendees) {
        const sent = await sendTelegramNotification(
          attendee.employeeId,
          `\uD83D\uDCCB Reminder: Conference report for *${conference.name}* is overdue. Please submit your report in Oxen OS \u2192 /conferences/${conference.id}`,
        )
        if (sent) notificationsSent++
      }
    }

    return NextResponse.json({
      overdueCount: overdueConferences.length,
      notificationsSent,
    })
  } catch (error) {
    console.error("Failed to check overdue conferences:", error)
    return NextResponse.json({ error: "Failed to check overdue conferences" }, { status: 500 })
  }
}
