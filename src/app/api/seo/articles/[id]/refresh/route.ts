import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import Anthropic from "@anthropic-ai/sdk"

const client = new Anthropic()

function countWords(html: string): number {
  const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
  return text ? text.split(" ").length : 0
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  const existing = await prisma.article.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 })
  }

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8000,
      system:
        "Rewrite and update this article with the latest information. Keep the same structure and optimization. Return the same JSON format.",
      messages: [
        {
          role: "user",
          content: `Title: ${existing.title}\n\nCurrent content:\n${existing.content}\n\nReturn ONLY valid JSON:\n{\n  "title": "...",\n  "slug": "...",\n  "metaDescription": "...",\n  "primaryKeyword": "...",\n  "secondaryKeywords": ["..."],\n  "content": "... (full HTML with h2, h3, p, ul, ol tags) ...",\n  "faqSchema": [{"question": "...", "answer": "..."}],\n  "socialPost": "... (3-4 sentence LinkedIn summary) ..."\n}`,
        },
      ],
    })

    const textBlock = message.content.find((block) => block.type === "text")
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json(
        { error: "Failed to refresh article" },
        { status: 500 }
      )
    }

    // Parse JSON response
    let jsonText = textBlock.text.trim()
    const jsonMatch = jsonText.match(/```(?:json)?\n?([\s\S]*?)```/)
    if (jsonMatch) {
      jsonText = jsonMatch[1].trim()
    }

    const refreshed = JSON.parse(jsonText)
    const wordCount = countWords(refreshed.content)

    const article = await prisma.article.update({
      where: { id },
      data: {
        title: refreshed.title || existing.title,
        content: refreshed.content,
        metaDescription: refreshed.metaDescription || existing.metaDescription,
        primaryKeyword: refreshed.primaryKeyword || existing.primaryKeyword,
        secondaryKeywords:
          refreshed.secondaryKeywords || existing.secondaryKeywords,
        socialPost: refreshed.socialPost || existing.socialPost,
        wordCount,
      },
    })

    return NextResponse.json({ article })
  } catch (err) {
    console.error("Article refresh error:", err)
    return NextResponse.json(
      { error: "Failed to refresh article. Check your Anthropic API key." },
      { status: 500 }
    )
  }
}
