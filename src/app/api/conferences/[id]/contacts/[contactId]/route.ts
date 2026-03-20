import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; contactId: string }> },
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { id, contactId } = await params
    const body = await request.json()

    const existing = await prisma.conferenceContact.findFirst({
      where: { id: contactId, conferenceId: id },
    })
    if (!existing) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 })
    }

    const {
      name, company, role, email, phone, linkedin, telegram,
      notes, interest, followUpAction,
    } = body

    const data: Record<string, unknown> = {}
    if (name !== undefined) data.name = name
    if (company !== undefined) data.company = company
    if (role !== undefined) data.role = role
    if (email !== undefined) data.email = email
    if (phone !== undefined) data.phone = phone
    if (linkedin !== undefined) data.linkedin = linkedin
    if (telegram !== undefined) data.telegram = telegram
    if (notes !== undefined) data.notes = notes
    if (interest !== undefined) data.interest = interest
    if (followUpAction !== undefined) data.followUpAction = followUpAction

    const contact = await prisma.conferenceContact.update({
      where: { id: contactId },
      data,
    })

    return NextResponse.json({ contact })
  } catch (error) {
    console.error("Failed to update contact:", error)
    return NextResponse.json({ error: "Failed to update contact" }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; contactId: string }> },
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { id, contactId } = await params

    const existing = await prisma.conferenceContact.findFirst({
      where: { id: contactId, conferenceId: id },
    })
    if (!existing) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 })
    }

    await prisma.conferenceContact.delete({ where: { id: contactId } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to delete contact:", error)
    return NextResponse.json({ error: "Failed to delete contact" }, { status: 500 })
  }
}
