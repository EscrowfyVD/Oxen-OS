import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

function countWords(html: string): number {
  const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
  return text ? text.split(" ").length : 0
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  const article = await prisma.article.findUnique({ where: { id } })
  if (!article) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 })
  }

  return NextResponse.json({ article })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()

  const existing = await prisma.article.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 })
  }

  const {
    title,
    slug,
    metaDescription,
    content,
    vertical,
    primaryKeyword,
    secondaryKeywords,
    status,
    scheduledFor,
    socialPost,
    socialPosted,
    reviewedBy,
    schemaJson,
  } = body

  // Recompute wordCount if content changes
  const wordCount =
    content !== undefined ? countWords(content) : undefined

  const article = await prisma.article.update({
    where: { id },
    data: {
      ...(title !== undefined && { title }),
      ...(slug !== undefined && { slug }),
      ...(metaDescription !== undefined && {
        metaDescription: metaDescription || null,
      }),
      ...(content !== undefined && { content }),
      ...(vertical !== undefined && { vertical }),
      ...(primaryKeyword !== undefined && {
        primaryKeyword: primaryKeyword || null,
      }),
      ...(secondaryKeywords !== undefined && { secondaryKeywords }),
      ...(wordCount !== undefined && { wordCount }),
      ...(status !== undefined && { status }),
      ...(scheduledFor !== undefined && {
        scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
      }),
      ...(socialPost !== undefined && { socialPost: socialPost || null }),
      ...(socialPosted !== undefined && { socialPosted }),
      ...(reviewedBy !== undefined && { reviewedBy: reviewedBy || null }),
      ...(schemaJson !== undefined && { schemaJson }),
    },
  })

  return NextResponse.json({ article })
}

export async function DELETE(
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

  await prisma.article.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
