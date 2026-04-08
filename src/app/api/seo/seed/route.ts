import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { SEED_KEYWORDS, SEED_NEWS_SOURCES, SEED_GEO_PROMPTS } from "@/lib/seo-config"

async function runSeed() {

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

  return { keywordsUpserted, sourcesCreated, promptsCreated }
}

export async function GET() {
  try {
    const result = await runSeed()
    return NextResponse.json({ seeded: true, keywords: result.keywordsUpserted, sources: result.sourcesCreated, prompts: result.promptsCreated })
  } catch (err) {
    console.error("[SEO Seed]", err)
    return NextResponse.json({ error: "Failed to seed" }, { status: 500 })
  }
}

export async function POST() {
  try {
    const result = await runSeed()
    return NextResponse.json({ seeded: true, keywords: result.keywordsUpserted, sources: result.sourcesCreated, prompts: result.promptsCreated })
  } catch (err) {
    console.error("[SEO Seed]", err)
    return NextResponse.json({ error: "Failed to seed" }, { status: 500 })
  }
}
