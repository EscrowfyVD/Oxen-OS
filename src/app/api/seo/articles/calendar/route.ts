import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function GET(request: Request) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const monthParam = searchParams.get("month")

  // Default to current month in YYYY-MM format
  const now = new Date()
  const [year, month] = monthParam
    ? monthParam.split("-").map(Number)
    : [now.getFullYear(), now.getMonth() + 1]

  const startOfMonth = new Date(year, month - 1, 1)
  const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999)

  // Fetch articles that fall in this month by publishedAt or scheduledFor
  const articles = await prisma.article.findMany({
    where: {
      OR: [
        {
          publishedAt: { gte: startOfMonth, lte: endOfMonth },
        },
        {
          scheduledFor: { gte: startOfMonth, lte: endOfMonth },
        },
      ],
    },
    orderBy: { createdAt: "asc" },
  })

  // Group by day
  const dayMap = new Map<
    string,
    {
      date: string
      articles: typeof articles
    }
  >()

  let totalPublished = 0
  let totalScheduled = 0

  for (const article of articles) {
    // Determine the relevant date for grouping
    const relevantDate = article.publishedAt || article.scheduledFor
    if (!relevantDate) continue

    const dateKey = relevantDate.toISOString().split("T")[0]

    if (!dayMap.has(dateKey)) {
      dayMap.set(dateKey, { date: dateKey, articles: [] })
    }
    dayMap.get(dateKey)!.articles.push(article)

    if (article.status === "published") {
      totalPublished++
    }
    if (article.scheduledFor && article.status !== "published") {
      totalScheduled++
    }
  }

  const days = [...dayMap.values()].sort((a, b) =>
    a.date.localeCompare(b.date)
  )

  return NextResponse.json({ days, totalPublished, totalScheduled })
}
