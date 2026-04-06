import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import Anthropic from "@anthropic-ai/sdk"

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const SYSTEM_PROMPT = `You are Sentinel, an AI assistant for Oxen Finance. Answer the user's question based ONLY on the provided internal wiki documentation. If the information is not in the wiki, say so clearly. Always cite which wiki page(s) your answer is based on. Be concise and actionable.`

function extractTextFromTiptapJson(content: unknown): string {
  if (!content || typeof content !== "object") return ""

  const node = content as Record<string, unknown>
  let text = ""

  if (node.type === "text" && typeof node.text === "string") {
    text += node.text
  }

  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      text += extractTextFromTiptapJson(child)
    }
    // Add newline after block-level nodes
    if (
      node.type === "paragraph" ||
      node.type === "heading" ||
      node.type === "listItem" ||
      node.type === "blockquote"
    ) {
      text += "\n"
    }
  }

  return text
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { question, pageSlug } = body as {
    question: string
    pageSlug?: string
  }

  if (!question || typeof question !== "string" || question.trim().length === 0) {
    return NextResponse.json(
      { error: "Missing required field: question" },
      { status: 400 }
    )
  }

  try {
    let wikiContext = ""
    const sources: Array<{ title: string; slug: string }> = []

    if (pageSlug) {
      // Fetch a single wiki page
      const page = await prisma.wikiPage.findUnique({
        where: { slug: pageSlug },
        select: { title: true, slug: true, content: true },
      })

      if (!page) {
        return NextResponse.json(
          { error: "Wiki page not found" },
          { status: 404 }
        )
      }

      const textContent = extractTextFromTiptapJson(page.content)
      wikiContext = `--- Wiki Page: "${page.title}" (slug: ${page.slug}) ---\n${textContent}\n---\n`
      sources.push({ title: page.title, slug: page.slug })
    } else {
      // Fetch all wiki pages (limit to 50 to stay within context limits)
      const pages = await prisma.wikiPage.findMany({
        where: { archived: false },
        select: { title: true, slug: true, content: true },
        orderBy: { updatedAt: "desc" },
        take: 50,
      })

      for (const page of pages) {
        const textContent = extractTextFromTiptapJson(page.content)
        wikiContext += `--- Wiki Page: "${page.title}" (slug: ${page.slug}) ---\n${textContent}\n---\n\n`
        sources.push({ title: page.title, slug: page.slug })
      }
    }

    if (!wikiContext.trim()) {
      return NextResponse.json({
        answer:
          "There are no wiki pages with content available to search. Please create some wiki pages first.",
        sources: [],
      })
    }

    const userMessage = `Here is the internal wiki documentation:\n\n${wikiContext}\n\nUser's question: ${question}`

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    })

    const textBlock = response.content.find((block) => block.type === "text")
    const answer = textBlock?.text ?? "I was unable to generate a response."

    // Filter sources to only those actually referenced in the answer
    const referencedSources = sources.filter(
      (s) =>
        answer.toLowerCase().includes(s.title.toLowerCase()) ||
        answer.toLowerCase().includes(s.slug.toLowerCase())
    )

    return NextResponse.json({
      answer,
      sources: referencedSources.length > 0 ? referencedSources : sources.slice(0, 3),
    })
  } catch (error) {
    console.error("[Wiki Ask] Error:", error)
    return NextResponse.json(
      { error: "Failed to process question" },
      { status: 500 }
    )
  }
}
