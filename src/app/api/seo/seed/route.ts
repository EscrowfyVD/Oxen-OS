import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { SEED_KEYWORDS, SEED_NEWS_SOURCES, SEED_GEO_PROMPTS } from "@/lib/seo-config"

export async function POST() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // 1. Upsert all seed keywords
  let keywordsUpserted = 0
  for (const kw of SEED_KEYWORDS) {
    await prisma.keyword.upsert({
      where: { keyword: kw.keyword },
      update: { vertical: kw.vertical },
      create: { keyword: kw.keyword, vertical: kw.vertical },
    })
    keywordsUpserted++
  }

  // 2. Create news sources (skip if name already exists)
  let sourcesCreated = 0
  for (const src of SEED_NEWS_SOURCES) {
    const exists = await prisma.newsSource.findFirst({ where: { name: src.name } })
    if (!exists) {
      await prisma.newsSource.create({
        data: {
          name: src.name,
          url: src.url,
          rssUrl: src.rssUrl,
          category: src.category,
        },
      })
      sourcesCreated++
    }
  }

  // 3. Create GEO test prompts (skip if prompt already exists)
  let promptsCreated = 0
  for (const gp of SEED_GEO_PROMPTS) {
    const exists = await prisma.geoTestPrompt.findFirst({ where: { prompt: gp.prompt } })
    if (!exists) {
      await prisma.geoTestPrompt.create({
        data: {
          prompt: gp.prompt,
          vertical: gp.vertical,
        },
      })
      promptsCreated++
    }
  }

  return NextResponse.json({
    seeded: true,
    keywords: keywordsUpserted,
    sources: sourcesCreated,
    prompts: promptsCreated,
  })
}
