import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function GET() {
  const session = await auth()
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const allKeywords = await prisma.keyword.findMany({
    where: { isTracked: true },
  })

  // ── Position Distribution ──
  let page1 = 0
  let page2 = 0
  let page3plus = 0
  let notRanking = 0

  for (const kw of allKeywords) {
    if (kw.currentPosition === null) {
      notRanking++
    } else if (kw.currentPosition >= 1 && kw.currentPosition <= 10) {
      page1++
    } else if (kw.currentPosition >= 11 && kw.currentPosition <= 20) {
      page2++
    } else {
      page3plus++
    }
  }

  const positionDistribution = { page1, page2, page3plus, notRanking }

  // ── Movement This Month ──
  let gained = 0
  let lost = 0
  let stable = 0

  for (const kw of allKeywords) {
    if (
      kw.currentPosition !== null &&
      kw.previousPosition !== null
    ) {
      if (kw.currentPosition < kw.previousPosition) {
        gained++
      } else if (kw.currentPosition > kw.previousPosition) {
        lost++
      } else {
        stable++
      }
    } else if (kw.currentPosition !== null && kw.previousPosition === null) {
      gained++
    } else {
      stable++
    }
  }

  const movementThisMonth = { gained, lost, stable }

  // ── Per Vertical ──
  const verticalCounts: Record<string, number> = {}
  for (const kw of allKeywords) {
    if (kw.currentPosition !== null && kw.currentPosition >= 1 && kw.currentPosition <= 10) {
      verticalCounts[kw.vertical] = (verticalCounts[kw.vertical] || 0) + 1
    }
  }

  const perVertical = Object.entries(verticalCounts).map(
    ([vertical, count]) => ({ vertical, page1Count: count })
  )

  // ── Top Performers ──
  const topPerformers = allKeywords
    .filter((kw) => kw.currentPosition !== null)
    .sort((a, b) => (a.currentPosition ?? 999) - (b.currentPosition ?? 999))
    .slice(0, 10)
    .map((kw) => ({
      id: kw.id,
      keyword: kw.keyword,
      vertical: kw.vertical,
      currentPosition: kw.currentPosition,
      previousPosition: kw.previousPosition,
      searchVolume: kw.searchVolume,
    }))

  return NextResponse.json({
    positionDistribution,
    movementThisMonth,
    perVertical,
    topPerformers,
  })
}
