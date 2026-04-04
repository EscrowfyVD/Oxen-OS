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

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ promptId: string }> }
) {
  const session = await auth()
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { promptId } = await params

  const prompt = await prisma.geoTestPrompt.findUnique({
    where: { id: promptId },
    include: {
      results: {
        orderBy: { testedAt: "desc" },
        take: 4,
      },
    },
  })

  if (!prompt) {
    return NextResponse.json({ error: "Prompt not found" }, { status: 404 })
  }

  const simulation = await simulateGeoTest(prompt.prompt)

  const previousResults = prompt.results
  const wasPreviouslyCited = previousResults.some((r) => r.oxenCited)
  const previousCompetitors = new Set(
    previousResults.flatMap((r) => r.competitorsCited)
  )

  const now = new Date()
  const createdResults = await Promise.all(
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

  await prisma.geoTestPrompt.update({
    where: { id: prompt.id },
    data: { lastTested: now },
  })

  const alerts: { type: string; severity: string; title: string }[] = []

  // Detect LOST CITATION
  if (wasPreviouslyCited && !simulation.oxenCited && previousResults.length > 0) {
    const alert = await prisma.seoAlert.create({
      data: {
        type: "geo_lost_citation",
        severity: "critical",
        title: `Lost citation: "${prompt.prompt.slice(0, 80)}"`,
        detail: `Oxen was previously cited for this prompt but is no longer mentioned in the latest simulation.`,
        promptId: prompt.id,
      },
    })
    alerts.push({ type: alert.type, severity: alert.severity, title: alert.title })
  }

  // Detect NEW COMPETITOR
  if (previousResults.length > 0) {
    const newCompetitors = simulation.competitorsCited.filter(
      (c) => !previousCompetitors.has(c)
    )
    for (const competitor of newCompetitors) {
      const alert = await prisma.seoAlert.create({
        data: {
          type: "geo_new_competitor",
          severity: "warning",
          title: `New competitor: ${competitor}`,
          detail: `"${competitor}" appeared in results for "${prompt.prompt.slice(0, 80)}" but was not seen in previous tests.`,
          promptId: prompt.id,
        },
      })
      alerts.push({ type: alert.type, severity: alert.severity, title: alert.title })
    }
  }

  return NextResponse.json({
    prompt: prompt.prompt,
    vertical: prompt.vertical,
    oxenCited: simulation.oxenCited,
    citationContext: simulation.citationContext,
    competitorsCited: simulation.competitorsCited,
    results: createdResults,
    alerts,
  })
}
