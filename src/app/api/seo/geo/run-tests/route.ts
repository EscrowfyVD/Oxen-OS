import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import Anthropic from "@anthropic-ai/sdk"

const client = new Anthropic()

const PLATFORMS = ["chatgpt", "perplexity", "claude", "google_ai"] as const

interface SimulationResult {
  oxenCited: boolean
  citationContext: string | null
  competitorsCited: string[]
  simulatedResponse: string
}

async function simulateGeoTest(promptText: string): Promise<SimulationResult> {
  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `If this question were asked to an AI assistant, would Oxen Finance likely be mentioned? Based on your knowledge, generate a realistic AI response to this question and indicate whether Oxen would be cited. Also list which competitors would likely be mentioned. Return JSON only: {"oxenCited": boolean, "citationContext": "exact quote where Oxen would be mentioned or null", "competitorsCited": ["competitor names"], "simulatedResponse": "the full AI response"}\n\nQuestion: ${promptText}`,
      },
    ],
  })

  const text =
    message.content[0].type === "text" ? message.content[0].text : ""

  // Extract JSON from the response (handle markdown code blocks)
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text]
  const jsonStr = (jsonMatch[1] || text).trim()

  try {
    return JSON.parse(jsonStr) as SimulationResult
  } catch {
    return {
      oxenCited: false,
      citationContext: null,
      competitorsCited: [],
      simulatedResponse: text,
    }
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function POST() {
  const session = await auth()
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const prompts = await prisma.geoTestPrompt.findMany({
    include: {
      results: {
        orderBy: { testedAt: "desc" },
        take: 4,
      },
    },
  })

  let testedCount = 0
  let citedCount = 0
  let alertCount = 0

  const BATCH_SIZE = 5

  for (let i = 0; i < prompts.length; i += BATCH_SIZE) {
    const batch = prompts.slice(i, i + BATCH_SIZE)

    const batchResults = await Promise.all(
      batch.map(async (prompt) => {
        const simulation = await simulateGeoTest(prompt.prompt)

        // Get previous results for comparison (the ones we loaded above)
        const previousResults = prompt.results
        const wasPreviouslyCited = previousResults.some((r) => r.oxenCited)
        const previousCompetitors = new Set(
          previousResults.flatMap((r) => r.competitorsCited)
        )

        // Create result records for all 4 platforms
        const now = new Date()
        await Promise.all(
          PLATFORMS.map((platform) =>
            prisma.geoTestResult.create({
              data: {
                promptId: prompt.id,
                platform,
                oxenCited: simulation.oxenCited,
                citationContext: simulation.citationContext,
                competitorsCited: simulation.competitorsCited,
                fullResponse: simulation.simulatedResponse,
                testedAt: now,
              },
            })
          )
        )

        // Update lastTested
        await prisma.geoTestPrompt.update({
          where: { id: prompt.id },
          data: { lastTested: now },
        })

        testedCount++
        if (simulation.oxenCited) citedCount++

        // Detect LOST CITATION
        if (wasPreviouslyCited && !simulation.oxenCited && previousResults.length > 0) {
          await prisma.seoAlert.create({
            data: {
              type: "geo_lost_citation",
              severity: "critical",
              title: `Lost citation: "${prompt.prompt.slice(0, 80)}"`,
              detail: `Oxen was previously cited for this prompt but is no longer mentioned in the latest simulation.`,
              promptId: prompt.id,
            },
          })
          alertCount++
        }

        // Detect NEW COMPETITOR
        if (previousResults.length > 0) {
          const newCompetitors = simulation.competitorsCited.filter(
            (c) => !previousCompetitors.has(c)
          )
          for (const competitor of newCompetitors) {
            await prisma.seoAlert.create({
              data: {
                type: "geo_new_competitor",
                severity: "warning",
                title: `New competitor: ${competitor}`,
                detail: `"${competitor}" appeared in results for "${prompt.prompt.slice(0, 80)}" but was not seen in previous tests.`,
                promptId: prompt.id,
              },
            })
            alertCount++
          }
        }
      })
    )

    // Small delay between batches to avoid rate limits
    if (i + BATCH_SIZE < prompts.length) {
      await delay(1000)
    }
  }

  return NextResponse.json({
    tested: testedCount,
    cited: citedCount,
    alerts: alertCount,
  })
}
