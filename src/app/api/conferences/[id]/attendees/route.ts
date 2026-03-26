import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// Bulk update attendee budgets — used for "apply to all" and batch saves
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { id } = await params
    const body = await request.json()
    const { updates } = body as { updates: { attendeeId: string; ticketCost?: number; hotelCost?: number; flightCost?: number; mealsCost?: number; otherCost?: number; budgetNotes?: string }[] }

    if (!Array.isArray(updates)) {
      return NextResponse.json({ error: "Missing updates array" }, { status: 400 })
    }

    await Promise.all(
      updates.map((u) => {
        const data: Record<string, unknown> = {}
        if (u.ticketCost !== undefined) data.ticketCost = u.ticketCost
        if (u.hotelCost !== undefined) data.hotelCost = u.hotelCost
        if (u.flightCost !== undefined) data.flightCost = u.flightCost
        if (u.mealsCost !== undefined) data.mealsCost = u.mealsCost
        if (u.otherCost !== undefined) data.otherCost = u.otherCost
        if (u.budgetNotes !== undefined) data.budgetNotes = u.budgetNotes
        return prisma.conferenceAttendee.update({
          where: { id: u.attendeeId },
          data,
        })
      }),
    )

    const attendees = await prisma.conferenceAttendee.findMany({
      where: { conferenceId: id },
      include: { employee: { select: { id: true, name: true } } },
    })

    return NextResponse.json({ attendees })
  } catch (error) {
    console.error("Failed to bulk update attendee budgets:", error)
    return NextResponse.json({ error: "Failed to update budgets" }, { status: 500 })
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
    const { employeeId, role } = body

    if (!employeeId) {
      return NextResponse.json({ error: "Missing required field: employeeId" }, { status: 400 })
    }

    // Check conference exists
    const conference = await prisma.conference.findUnique({ where: { id } })
    if (!conference) {
      return NextResponse.json({ error: "Conference not found" }, { status: 404 })
    }

    // Check for duplicate
    const existing = await prisma.conferenceAttendee.findFirst({
      where: { conferenceId: id, employeeId },
    })
    if (existing) {
      return NextResponse.json({ error: "Employee is already an attendee" }, { status: 409 })
    }

    const attendee = await prisma.conferenceAttendee.create({
      data: {
        conferenceId: id,
        employeeId,
        role: role ?? null,
      },
      include: {
        employee: {
          select: { id: true, name: true, initials: true, avatarColor: true, email: true, icon: true },
        },
      },
    })

    return NextResponse.json({ attendee }, { status: 201 })
  } catch (error) {
    console.error("Failed to add attendee:", error)
    return NextResponse.json({ error: "Failed to add attendee" }, { status: 500 })
  }
}
