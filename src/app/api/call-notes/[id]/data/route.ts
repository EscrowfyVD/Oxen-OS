import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { prisma } from "@/lib/prisma"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin()
  if (error) return error

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
  const { error } = await requireAdmin()
  if (error) return error

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
