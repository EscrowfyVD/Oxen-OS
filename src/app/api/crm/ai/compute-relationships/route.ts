import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const now = new Date()
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    // Find all contacts that have at least 1 activity
    const contacts = await prisma.crmContact.findMany({
      where: {
        activities: { some: {} },
      },
      select: {
        id: true,
        activities: {
          orderBy: { createdAt: "desc" },
        },
      },
    })

    let computed = 0

    for (const contact of contacts) {
      const allActivities = contact.activities
      const recentActivities = allActivities.filter((a) => a.createdAt >= thirtyDaysAgo)

      // 1. Email frequency last 30 days: 0-25 points
      const emailsSent = recentActivities.filter(
        (a) => a.type === "email_sent" || a.type === "email_received"
      ).length
      let emailFreqPoints = 0
      if (emailsSent > 10) emailFreqPoints = 25
      else if (emailsSent >= 5) emailFreqPoints = 15
      else if (emailsSent >= 1) emailFreqPoints = 8

      // 2. Email recency: 0-25 points
      const lastEmail = allActivities.find(
        (a) => a.type === "email_sent" || a.type === "email_received"
      )
      let emailRecencyPoints = 0
      if (lastEmail) {
        const daysSinceEmail = Math.floor(
          (now.getTime() - lastEmail.createdAt.getTime()) / (1000 * 60 * 60 * 24)
        )
        if (daysSinceEmail < 3) emailRecencyPoints = 25
        else if (daysSinceEmail < 7) emailRecencyPoints = 20
        else if (daysSinceEmail < 14) emailRecencyPoints = 10
        else if (daysSinceEmail < 30) emailRecencyPoints = 5
      }

      // 3. Response rate: 0-25 points
      // Approximate response rate as: emails received / emails sent
      const totalSent = allActivities.filter((a) => a.type === "email_sent").length
      const totalReceived = allActivities.filter((a) => a.type === "email_received").length
      let responseRatePoints = 0
      if (totalSent > 0) {
        const responseRate = (totalReceived / totalSent) * 100
        if (responseRate > 80) responseRatePoints = 25
        else if (responseRate > 60) responseRatePoints = 18
        else if (responseRate > 40) responseRatePoints = 10
        else responseRatePoints = 5
      } else if (totalReceived > 0) {
        // They emailed us without us sending first — strong signal
        responseRatePoints = 25
      }

      // 4. Meetings last 30 days: 0-25 points
      const meetingsCount = recentActivities.filter(
        (a) => a.type === "meeting_calendly" || a.type === "meeting_manual"
      ).length
      let meetingPoints = 0
      if (meetingsCount >= 3) meetingPoints = 25
      else if (meetingsCount === 2) meetingPoints = 18
      else if (meetingsCount === 1) meetingPoints = 12

      // Total score
      const score = emailFreqPoints + emailRecencyPoints + responseRatePoints + meetingPoints

      // Map to relationship strength
      let strength: string
      if (score >= 70) strength = "strong"
      else if (score >= 40) strength = "warm"
      else if (score >= 10) strength = "cold"
      else strength = "no_relationship"

      await prisma.crmContact.update({
        where: { id: contact.id },
        data: {
          relationshipScore: score,
          relationshipStrength: strength,
        },
      })

      computed++
    }

    return NextResponse.json({ computed })
  } catch (error) {
    console.error("[Compute Relationships]", error)
    return NextResponse.json({ error: "Failed to compute relationships" }, { status: 500 })
  }
}
