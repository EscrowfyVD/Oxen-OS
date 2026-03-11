import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function PATCH(request: Request) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { items } = body

  if (!Array.isArray(items)) {
    return NextResponse.json({ error: "Missing items array" }, { status: 400 })
  }

  // items: [{ id, order, parentId? }]
  for (const item of items) {
    await prisma.wikiPage.update({
      where: { id: item.id },
      data: {
        order: item.order,
        ...(item.parentId !== undefined && { parentId: item.parentId }),
      },
    })
  }

  return NextResponse.json({ success: true })
}
