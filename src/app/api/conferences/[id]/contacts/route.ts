import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { id } = await params

    const conference = await prisma.conference.findUnique({ where: { id } })
    if (!conference) {
      return NextResponse.json({ error: "Conference not found" }, { status: 404 })
    }

    const contacts = await prisma.conferenceContact.findMany({
      where: { conferenceId: id },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ contacts })
  } catch (error) {
    console.error("Failed to fetch contacts:", error)
    return NextResponse.json({ error: "Failed to fetch contacts" }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { id } = await params
    const body = await request.json()
    const {
      name, company, role, email, phone, linkedin, telegram,
      notes, interest, followUpAction, collectedBy,
    } = body

    if (!name) {
      return NextResponse.json({ error: "Missing required field: name" }, { status: 400 })
    }

    const conference = await prisma.conference.findUnique({ where: { id } })
    if (!conference) {
      return NextResponse.json({ error: "Conference not found" }, { status: 404 })
    }

    const contact = await prisma.conferenceContact.create({
      data: {
        conferenceId: id,
        name,
        company: company ?? null,
        role: role ?? null,
        email: email ?? null,
        phone: phone ?? null,
        linkedin: linkedin ?? null,
        telegram: telegram ?? null,
        notes: notes ?? null,
        interest: interest ?? null,
        followUpAction: followUpAction ?? null,
        collectedBy: collectedBy ?? session.user?.email ?? "unknown",
      },
    })

    return NextResponse.json({ contact }, { status: 201 })
  } catch (error) {
    console.error("Failed to add contact:", error)
    return NextResponse.json({ error: "Failed to add contact" }, { status: 500 })
  }
}
