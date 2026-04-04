import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function GET() {
  const session = await auth()
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const allResults = await prisma.geoTestResult.findMany({
    select: {
      oxenCited: true,
      competitorsCited: true,
    },
  })

  const totalResults = allResults.length

  // Count Oxen citations
  const oxenCitations = allResults.filter((r) => r.oxenCited).length

  // Count competitor mentions
  const competitorCounts: Record<string, number> = {}
  for (const result of allResults) {
    for (const competitor of result.competitorsCited) {
      competitorCounts[competitor] = (competitorCounts[competitor] || 0) + 1
    }
  }

  // Sort competitors by citation count desc
  const competitors = Object.entries(competitorCounts)
    .map(([name, citations]) => ({
      name,
      citations,
      rate: totalResults > 0 ? Math.round((citations / totalResults) * 100) : 0,
    }))
    .sort((a, b) => b.citations - a.citations)

  return NextResponse.json({
    oxen: {
      citations: oxenCitations,
      rate:
        totalResults > 0
          ? Math.round((oxenCitations / totalResults) * 100)
          : 0,
    },
    competitors,
    totalResults,
  })
}
