import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(request: Request) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const wikiPageId = searchParams.get("wikiPageId")
  const contactId = searchParams.get("contactId")
  const agentId = searchParams.get("agentId")
  const entityId = searchParams.get("entityId")

  const where: Record<string, unknown> = {}
  if (wikiPageId) where.wikiPageId = wikiPageId
  if (contactId) where.contactId = contactId
  if (agentId) where.agentId = agentId
  if (entityId) where.entityId = entityId

  const links = await prisma.driveLink.findMany({
    where,
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json({ links })
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { driveFileId, fileName, fileUrl, mimeType, iconUrl, category, contactId, agentId, wikiPageId, entityId } = body

  if (!driveFileId || !fileName || !fileUrl || !mimeType) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }

  const userId = session.user?.email ?? "unknown"

  const link = await prisma.driveLink.create({
    data: {
      driveFileId,
      fileName,
      fileUrl,
      mimeType,
      iconUrl: iconUrl ?? null,
      category: category ?? null,
      contactId: contactId ?? null,
      agentId: agentId ?? null,
      wikiPageId: wikiPageId ?? null,
      entityId: entityId ?? null,
      createdBy: userId,
    },
  })

  return NextResponse.json({ link }, { status: 201 })
}
