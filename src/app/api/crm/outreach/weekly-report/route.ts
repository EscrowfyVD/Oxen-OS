import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"

// POST /api/crm/outreach/weekly-report — generate weekly outreach report
export async function POST() {
  const { error } = await requirePageAccess("crm")
  if (error) return error

  try {
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    // Query campaigns updated in last 7 days
    const recentCampaigns = await prisma.outreachCampaign.findMany({
      where: { updatedAt: { gte: sevenDaysAgo } },
      include: { domain: true },
      orderBy: { totalReplied: "desc" },
    })

    // Query all domains for health status
    const domains = await prisma.outreachDomain.findMany({
      orderBy: { domain: "asc" },
    })

    // Query alerts created in last 7 days
    const recentAlerts = await prisma.outreachAlert.findMany({
      where: { createdAt: { gte: sevenDaysAgo } },
      orderBy: { createdAt: "desc" },
    })

    // Compute aggregate metrics
    const totalSent = recentCampaigns.reduce((sum, c) => sum + c.totalSent, 0)
    const totalReplied = recentCampaigns.reduce((sum, c) => sum + c.totalReplied, 0)
    const totalOpened = recentCampaigns.reduce((sum, c) => sum + c.totalOpened, 0)
    const totalBounced = recentCampaigns.reduce((sum, c) => sum + c.totalBounced, 0)
    const totalMeetingsBooked = recentCampaigns.reduce((sum, c) => sum + c.meetingsBooked, 0)
    const avgReplyRate = totalSent > 0 ? ((totalReplied / totalSent) * 100) : 0
    const avgOpenRate = totalSent > 0 ? ((totalOpened / totalSent) * 100) : 0

    // Find top campaign by replies
    const topCampaign = recentCampaigns.length > 0
      ? {
          name: recentCampaigns[0].name,
          owner: recentCampaigns[0].owner,
          totalReplied: recentCampaigns[0].totalReplied,
          totalSent: recentCampaigns[0].totalSent,
          replyRate: recentCampaigns[0].totalSent > 0
            ? ((recentCampaigns[0].totalReplied / recentCampaigns[0].totalSent) * 100).toFixed(1)
            : "0.0",
        }
      : null

    // Domain health summary
    const domainHealth = domains.map((d) => ({
      domain: d.domain,
      owner: d.owner,
      status: d.status,
      openRate: d.openRate != null ? `${d.openRate.toFixed(1)}%` : "N/A",
      bounceRate: d.bounceRate != null ? `${d.bounceRate.toFixed(1)}%` : "N/A",
      spf: d.spfValid,
      dkim: d.dkimValid,
      dmarc: d.dmarcValid,
      isBlacklisted: d.isBlacklisted,
      lastHealthCheck: d.lastHealthCheck?.toISOString() ?? null,
    }))

    // Build action items from unresolved alerts
    const unresolvedAlerts = recentAlerts.filter((a) => !a.resolved)
    const actionItems = unresolvedAlerts.map((a) => ({
      severity: a.severity,
      title: a.title,
      detail: a.detail,
    }))

    const report = {
      period: {
        from: sevenDaysAgo.toISOString(),
        to: new Date().toISOString(),
      },
      metrics: {
        totalSent,
        totalOpened,
        totalReplied,
        totalBounced,
        totalMeetingsBooked,
        avgOpenRate: `${avgOpenRate.toFixed(1)}%`,
        avgReplyRate: `${avgReplyRate.toFixed(1)}%`,
        activeCampaigns: recentCampaigns.length,
      },
      topCampaign,
      domainHealth,
      alerts: {
        total: recentAlerts.length,
        unresolved: unresolvedAlerts.length,
        resolved: recentAlerts.length - unresolvedAlerts.length,
      },
      actionItems,
    }

    return NextResponse.json({ report })
  } catch (err) {
    console.error("[Outreach Weekly Report]", err)
    return NextResponse.json({ error: "Failed to generate weekly report" }, { status: 500 })
  }
}
