import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; attendeeId: string }> },
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { id, attendeeId } = await params
    const body = await request.json()

    const attendee = await prisma.conferenceAttendee.findFirst({
      where: { id: attendeeId, conferenceId: id },
    })
    if (!attendee) {
      return NextResponse.json({ error: "Attendee not found" }, { status: 404 })
    }

    const data: Record<string, unknown> = {}
    if (body.ticketCost !== undefined) data.ticketCost = parseFloat(body.ticketCost) || 0
    if (body.hotelCost !== undefined) data.hotelCost = parseFloat(body.hotelCost) || 0
    if (body.flightCost !== undefined) data.flightCost = parseFloat(body.flightCost) || 0
    if (body.taxiCost !== undefined) data.taxiCost = parseFloat(body.taxiCost) || 0
    if (body.mealsCost !== undefined) data.mealsCost = parseFloat(body.mealsCost) || 0
    if (body.otherCost !== undefined) data.otherCost = parseFloat(body.otherCost) || 0
    if (body.budgetNotes !== undefined) data.budgetNotes = body.budgetNotes

    const updated = await prisma.conferenceAttendee.update({
      where: { id: attendeeId },
      data,
      include: { employee: { select: { id: true, name: true } } },
    })

    return NextResponse.json({ attendee: updated })
  } catch (error) {
    console.error("Failed to update attendee budget:", error)
    return NextResponse.json({ error: "Failed to update attendee budget" }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; attendeeId: string }> },
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { id, attendeeId } = await params

    const attendee = await prisma.conferenceAttendee.findFirst({
      where: { id: attendeeId, conferenceId: id },
    })
    if (!attendee) {
      return NextResponse.json({ error: "Attendee not found" }, { status: 404 })
    }

    await prisma.conferenceAttendee.delete({ where: { id: attendeeId } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to remove attendee:", error)
    return NextResponse.json({ error: "Failed to remove attendee" }, { status: 500 })
  }
}
