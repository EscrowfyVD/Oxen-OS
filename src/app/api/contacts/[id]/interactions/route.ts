import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()
  const { type, content } = body

  if (!type || !content) {
    return NextResponse.json(
      { error: "Missing required fields: type, content" },
      { status: 400 }
    )
  }

  const contact = await prisma.contact.findUnique({ where: { id } })
  if (!contact) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 })
  }

  const userId = session.user?.email ?? "unknown"

  const interaction = await prisma.interaction.create({
    data: {
      contactId: id,
      type,
      content,
      createdBy: userId,
    },
  })

  return NextResponse.json({ interaction }, { status: 201 })
}
