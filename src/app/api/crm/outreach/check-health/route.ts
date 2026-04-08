import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"

interface AlertInput {
  type: string
  severity: string
  domainId: string
  title: string
  detail: string
}

// POST /api/crm/outreach/check-health — run health checks on all domains
export async function POST() {
  const { error } = await requirePageAccess("crm")
  if (error) return error

  try {
    const domains = await prisma.outreachDomain.findMany({
      include: { campaigns: true },
    })

    const alertsToCreate: AlertInput[] = []

    for (const domain of domains) {
      // Calculate aggregate metrics from campaigns
      const campaigns = domain.campaigns
      if (campaigns.length > 0) {
        const totalSent = campaigns.reduce((sum, c) => sum + c.totalSent, 0)
        const totalOpened = campaigns.reduce((sum, c) => sum + c.totalOpened, 0)
        const totalReplied = campaigns.reduce((sum, c) => sum + c.totalReplied, 0)
        const totalBounced = campaigns.reduce((sum, c) => sum + c.totalBounced, 0)

        const openRate = totalSent > 0 ? (totalOpened / totalSent) * 100 : 0
        const replyRate = totalSent > 0 ? (totalReplied / totalSent) * 100 : 0
        const bounceRate = totalSent > 0 ? (totalBounced / totalSent) * 100 : 0

        // Update domain metrics
        await prisma.outreachDomain.update({
          where: { id: domain.id },
          data: {
            openRate,
            replyRate,
            bounceRate,
          },
        })

        // Check bounce rate > 2%
        if (bounceRate > 2) {
          alertsToCreate.push({
            type: "high_bounce_rate",
            severity: "critical",
            domainId: domain.id,
            title: `High bounce rate on ${domain.domain}`,
            detail: `Bounce rate is ${bounceRate.toFixed(1)}% (threshold: 2%). Total bounced: ${totalBounced} out of ${totalSent} sent.`,
          })
        }

        // Check spam rate > 0.3%
        if (domain.spamRate != null && domain.spamRate > 0.3) {
          alertsToCreate.push({
            type: "high_spam_rate",
            severity: "critical",
            domainId: domain.id,
            title: `High spam rate on ${domain.domain}`,
            detail: `Spam rate is ${domain.spamRate.toFixed(2)}% (threshold: 0.3%).`,
          })
        }

        // Check open rate < 30%
        if (totalSent > 0 && openRate < 30) {
          alertsToCreate.push({
            type: "low_open_rate",
            severity: "warning",
            domainId: domain.id,
            title: `Low open rate on ${domain.domain}`,
            detail: `Open rate is ${openRate.toFixed(1)}% (threshold: 30%). Total opened: ${totalOpened} out of ${totalSent} sent.`,
          })
        }
      }

      // Check blacklist status
      if (domain.isBlacklisted) {
        alertsToCreate.push({
          type: "blacklisted",
          severity: "critical",
          domainId: domain.id,
          title: `Domain ${domain.domain} is blacklisted`,
          detail: domain.blacklistDetails ?? "Domain appears on one or more blacklists. Immediate action required.",
        })
      }

      // Check DNS authentication
      if (!domain.spfValid || !domain.dkimValid || !domain.dmarcValid) {
        const missing: string[] = []
        if (!domain.spfValid) missing.push("SPF")
        if (!domain.dkimValid) missing.push("DKIM")
        if (!domain.dmarcValid) missing.push("DMARC")

        alertsToCreate.push({
          type: "dns_auth_missing",
          severity: "warning",
          domainId: domain.id,
          title: `Missing DNS authentication on ${domain.domain}`,
          detail: `The following DNS records are not valid: ${missing.join(", ")}. Configure these to improve deliverability.`,
        })
      }

      // Update lastHealthCheck timestamp
      await prisma.outreachDomain.update({
        where: { id: domain.id },
        data: { lastHealthCheck: new Date() },
      })
    }

    // Bulk create all alerts
    if (alertsToCreate.length > 0) {
      await prisma.outreachAlert.createMany({
        data: alertsToCreate,
      })
    }

    return NextResponse.json({
      checked: domains.length,
      alerts: alertsToCreate.length,
    })
  } catch (err) {
    console.error("[Outreach Check Health]", err)
    return NextResponse.json({ error: "Failed to run health checks" }, { status: 500 })
  }
}
