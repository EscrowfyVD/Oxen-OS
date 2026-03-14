import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const entities = await prisma.orgEntity.findMany({
    include: {
      children: true,
      parent: true,
      employees: {
        select: { id: true, name: true, initials: true, avatarColor: true, icon: true },
        take: 5,
        orderBy: { order: "asc" },
      },
      _count: { select: { employees: true } },
    },
    orderBy: { order: "asc" },
  })

  return NextResponse.json({ entities })
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { name, jurisdiction, type, parentId, order } = body

  if (!name) {
    return NextResponse.json(
      { error: "Missing required field: name" },
      { status: 400 }
    )
  }

  const entity = await prisma.orgEntity.create({
    data: {
      name,
      jurisdiction: jurisdiction ?? null,
      type: type ?? "Operating Entity",
      parentId: parentId ?? null,
      order: order ?? 0,
    },
  })

  return NextResponse.json({ entity }, { status: 201 })
}
