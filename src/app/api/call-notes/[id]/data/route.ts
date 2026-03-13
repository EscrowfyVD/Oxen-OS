import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  const note = await prisma.callNote.findUnique({
    where: { id },
    select: { id: true, noteData: true },
  })

  if (!note) {
    return NextResponse.json({ error: "Call note not found" }, { status: 404 })
  }

  return NextResponse.json({ noteData: note.noteData })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session2 = await auth()
  if (!session2?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const { noteData } = body

  const existing = await prisma.callNote.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: "Call note not found" }, { status: 404 })
  }

  const note = await prisma.callNote.update({
    where: { id },
    data: { noteData },
    select: { id: true, noteData: true },
  })

  return NextResponse.json({ noteData: note.noteData })
}
