import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const existing = await prisma.socialMetrics.count()
  if (existing > 0) {
    return NextResponse.json({ message: "Data already exists", count: existing })
  }

  const userId = session.user?.id ?? session.user?.email ?? "unknown"

  // Seed 6 months of social metrics
  const metricsData: Array<{
    platform: string; date: Date; followers: number; impressions: number;
    engagement: number; clicks: number; posts: number; entity: string; createdBy: string
  }> = []

  const platforms = [
    { id: "linkedin", baseFollowers: 4200, growth: 180, baseImpressions: 15000, baseEngagement: 600 },
    { id: "twitter", baseFollowers: 2800, growth: 120, baseImpressions: 22000, baseEngagement: 450 },
    { id: "telegram", baseFollowers: 1500, growth: 90, baseImpressions: 8000, baseEngagement: 320 },
    { id: "instagram", baseFollowers: 1100, growth: 70, baseImpressions: 12000, baseEngagement: 380 },
  ]

  for (let i = 0; i < 6; i++) {
    const d = new Date(2025, 8 + i, 1) // Sep 2025 → Feb 2026
    for (const p of platforms) {
      metricsData.push({
        platform: p.id,
        date: d,
        followers: p.baseFollowers + p.growth * i + Math.round(Math.random() * 50),
        impressions: p.baseImpressions + Math.round(Math.random() * 5000),
        engagement: p.baseEngagement + Math.round(Math.random() * 200),
        clicks: 100 + Math.round(Math.random() * 150),
        posts: 8 + Math.round(Math.random() * 12),
        entity: "oxen",
        createdBy: userId,
      })
    }
  }

  await prisma.socialMetrics.createMany({ data: metricsData })

  // Seed content ideas
  const ideas = [
    { title: "SiGMA Europe Recap Thread", description: "Thread covering our key takeaways, meetings, and wins from SiGMA Europe 2025", platform: "twitter", type: "thread", status: "idea", priority: "high", tags: ["brand", "thought_leadership"] },
    { title: "iGaming Compliance 2026 Guide", description: "Comprehensive LinkedIn article on upcoming regulatory changes", platform: "linkedin", type: "article", status: "draft", priority: "high", tags: ["compliance", "thought_leadership"] },
    { title: "Team Culture Video", description: "Behind-the-scenes of Malta office, team lunch, work culture", platform: "instagram", type: "video", status: "scheduled", priority: "medium", tags: ["brand", "hiring"] },
    { title: "Product Update: New Dashboard", description: "Announce the new client dashboard with screenshots", platform: "all", type: "post", status: "published", priority: "medium", tags: ["product", "announcement"] },
    { title: "FX Spread Explainer Infographic", description: "Visual explanation of how our FX spread works vs competitors", platform: "linkedin", type: "infographic", status: "idea", priority: "medium", tags: ["product", "thought_leadership"] },
    { title: "Telegram Community AMA", description: "Monthly AMA session with CEO in Telegram group", platform: "telegram", type: "post", status: "idea", priority: "low", tags: ["brand", "community"] },
    { title: "Client Success Story: Luxury Brand", description: "Case study of how we helped a luxury brand with payments", platform: "linkedin", type: "article", status: "draft", priority: "high", tags: ["brand", "thought_leadership"] },
    { title: "Weekly Market Pulse", description: "Short weekly post on fintech/crypto market movements", platform: "twitter", type: "post", status: "idea", priority: "low", tags: ["thought_leadership"] },
  ]

  for (const idea of ideas) {
    await prisma.contentIdea.create({
      data: { ...idea, createdBy: userId },
    })
  }

  // Seed marketing intel
  const intel = [
    { type: "competitor", title: "PayRetailers expands to Malta", source: "https://payretailers.com/press", summary: "PayRetailers announced opening a Malta office targeting iGaming clients, directly competing with our core market. They are offering 0.5% lower take rates as an introductory offer.", relevance: "high", tags: ["igaming", "pricing"] },
    { type: "trend", title: "AI-Powered KYC Becoming Standard", source: "Fintech Times", summary: "Major payment providers are adopting AI-driven KYC processes, reducing onboarding time from days to minutes. We should evaluate integrating similar technology.", relevance: "high", tags: ["compliance", "technology"] },
    { type: "tool", title: "Notion AI for Content Planning", source: "Product Hunt", summary: "Notion released AI features for content calendar management. Could improve our content planning workflow and reduce manual scheduling.", relevance: "medium", tags: ["marketing", "tools"] },
    { type: "regulation", title: "EU MiCA Regulation Timeline Update", source: "European Commission", summary: "MiCA implementation timeline shifted. Full compliance required by Q3 2026 for crypto-related payment services. Need to review our compliance roadmap.", relevance: "high", tags: ["compliance", "crypto"] },
    { type: "opportunity", title: "Affiliate Marketing for iGaming Operators", source: "Internal Research", summary: "Research shows iGaming operators respond well to affiliate-style partnerships. Could create a referral program with revenue share to accelerate client acquisition.", relevance: "medium", tags: ["growth", "igaming"] },
  ]

  for (const item of intel) {
    await prisma.marketingIntel.create({
      data: { ...item, createdBy: userId },
    })
  }

  return NextResponse.json({ success: true, metrics: metricsData.length, ideas: ideas.length, intel: intel.length })
}
