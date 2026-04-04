import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function GET() {
  const session = await auth()
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Fetch all prompts with their latest results (one per platform)
  const prompts = await prisma.geoTestPrompt.findMany({
    include: {
      results: {
        orderBy: { testedAt: "desc" },
      },
    },
    orderBy: { vertical: "asc" },
  })

  // For each prompt, keep only the latest result per platform
  const grouped = prompts.map((prompt) => {
    const latestByPlatform: Record<string, typeof prompt.results[0]> = {}
    for (const result of prompt.results) {
      if (!latestByPlatform[result.platform]) {
        latestByPlatform[result.platform] = result
      }
    }

    const latestResults = Object.values(latestByPlatform)
    const totalPlatforms = latestResults.length
    const citedPlatforms = latestResults.filter((r) => r.oxenCited).length

    return {
      promptId: prompt.id,
      prompt: prompt.prompt,
      vertical: prompt.vertical,
      lastTested: prompt.lastTested,
      results: latestResults,
      citationRate:
        totalPlatforms > 0
          ? Math.round((citedPlatforms / totalPlatforms) * 100)
          : 0,
      perPlatform: latestResults.map((r) => ({
        platform: r.platform,
        oxenCited: r.oxenCited,
        competitorsCited: r.competitorsCited,
        testedAt: r.testedAt,
      })),
    }
  })

  return NextResponse.json(grouped)
}
