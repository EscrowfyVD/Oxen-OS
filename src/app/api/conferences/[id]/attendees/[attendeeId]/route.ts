import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { serializeMoney, toDecimal } from "@/lib/decimal"

// Sprint 3.2 — non-throwing parser for user-entered monetary strings.
// parseFloat loses exact precision for fractional decimals ("19.99" → 19.99 ±ε);
// toDecimal preserves exact precision but throws on invalid input. This wrapper
// keeps the "|| 0" fallback semantics of the previous parseFloat path.
function safeMoney(v: unknown): Prisma.Decimal {
  if (v === null || v === undefined || v === "") return new Prisma.Decimal(0)
  try {
    return toDecimal(v as string | number)
  } catch {
    return new Prisma.Decimal(0)
  }
}

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

    // Sprint 3.2 — Pattern C: user input → Decimal (exact precision, no float drift).
    const data: Record<string, unknown> = {}
    if (body.ticketCost !== undefined) data.ticketCost = safeMoney(body.ticketCost)
    if (body.hotelCost !== undefined) data.hotelCost = safeMoney(body.hotelCost)
    if (body.flightCost !== undefined) data.flightCost = safeMoney(body.flightCost)
    if (body.taxiCost !== undefined) data.taxiCost = safeMoney(body.taxiCost)
    if (body.mealsCost !== undefined) data.mealsCost = safeMoney(body.mealsCost)
    if (body.otherCost !== undefined) data.otherCost = safeMoney(body.otherCost)
    if (body.budgetNotes !== undefined) data.budgetNotes = body.budgetNotes

    const updated = await prisma.conferenceAttendee.update({
      where: { id: attendeeId },
      data,
      include: { employee: { select: { id: true, name: true } } },
    })

    // Sprint 3.2 — serialize Decimal costs for JSON.
    return NextResponse.json({
      attendee: {
        ...updated,
        ticketCost: serializeMoney(updated.ticketCost),
        hotelCost: serializeMoney(updated.hotelCost),
        flightCost: serializeMoney(updated.flightCost),
        taxiCost: serializeMoney(updated.taxiCost),
        mealsCost: serializeMoney(updated.mealsCost),
        otherCost: serializeMoney(updated.otherCost),
      },
    })
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
