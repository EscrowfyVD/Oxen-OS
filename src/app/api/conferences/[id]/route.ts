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

    const conference = await prisma.conference.findUnique({
      where: { id },
      include: {
        attendees: {
          include: {
            employee: {
              select: { id: true, name: true, initials: true, avatarColor: true, email: true, icon: true },
            },
          },
        },
        collectedContacts: {
          include: {
            contact: true,
          },
        },
        report: true,
        driveLinks: true,
      },
    })

    if (!conference) {
      return NextResponse.json({ error: "Conference not found" }, { status: 404 })
    }

    return NextResponse.json({ conference })
  } catch (error) {
    console.error("Failed to fetch conference:", error)
    return NextResponse.json({ error: "Failed to fetch conference" }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { id } = await params
    const body = await request.json()

    const existing = await prisma.conference.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: "Conference not found" }, { status: 404 })
    }

    const {
      name, location, country, startDate, endDate, website, description,
      status, ticketCost, hotelCost, flightCost, mealsCost, otherCost,
      currency, budgetNotes, attendees,
    } = body

    const data: Record<string, unknown> = {}

    if (name !== undefined) data.name = name
    if (location !== undefined) data.location = location
    if (country !== undefined) data.country = country
    if (startDate !== undefined) data.startDate = new Date(startDate)
    if (endDate !== undefined) data.endDate = new Date(endDate)
    if (website !== undefined) data.website = website
    if (description !== undefined) data.description = description
    if (status !== undefined) data.status = status
    if (ticketCost !== undefined) data.ticketCost = parseFloat(ticketCost)
    if (hotelCost !== undefined) data.hotelCost = parseFloat(hotelCost)
    if (flightCost !== undefined) data.flightCost = parseFloat(flightCost)
    if (mealsCost !== undefined) data.mealsCost = parseFloat(mealsCost)
    if (otherCost !== undefined) data.otherCost = parseFloat(otherCost)
    if (currency !== undefined) data.currency = currency
    if (budgetNotes !== undefined) data.budgetNotes = budgetNotes

    // If attendees array provided, delete existing and recreate
    if (Array.isArray(attendees)) {
      await prisma.conferenceAttendee.deleteMany({ where: { conferenceId: id } })
      if (attendees.length > 0) {
        await prisma.conferenceAttendee.createMany({
          data: attendees.map((a: { employeeId: string; role?: string }) => ({
            conferenceId: id,
            employeeId: a.employeeId,
            role: a.role ?? null,
          })),
        })
      }
    }

    const conference = await prisma.conference.update({
      where: { id },
      data,
      include: {
        attendees: {
          include: {
            employee: {
              select: { id: true, name: true, initials: true, avatarColor: true, email: true, icon: true },
            },
          },
        },
      },
    })

    // Update linked InternalEvent if title or dates changed
    if (name !== undefined || startDate !== undefined || endDate !== undefined) {
      const eventData: Record<string, unknown> = {}
      if (name !== undefined) eventData.title = name
      if (startDate !== undefined) eventData.startTime = new Date(startDate)
      if (endDate !== undefined) eventData.endTime = new Date(endDate)

      if (existing.calendarEventId) {
        await prisma.internalEvent.update({
          where: { id: existing.calendarEventId },
          data: eventData,
        }).catch(() => {
          // InternalEvent may not exist; ignore
        })
      } else {
        // Try to find by title and type match
        const event = await prisma.internalEvent.findFirst({
          where: {
            type: "conference",
            title: existing.name,
            startTime: existing.startDate,
          },
        })
        if (event) {
          await prisma.internalEvent.update({
            where: { id: event.id },
            data: eventData,
          })
        }
      }
    }

    return NextResponse.json({ conference })
  } catch (error) {
    console.error("Failed to update conference:", error)
    return NextResponse.json({ error: "Failed to update conference" }, { status: 500 })
  }
}

export async function DELETE(
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

    // Delete linked InternalEvent
    if (conference.calendarEventId) {
      await prisma.internalEvent.delete({
        where: { id: conference.calendarEventId },
      }).catch(() => {})
    } else {
      const event = await prisma.internalEvent.findFirst({
        where: {
          type: "conference",
          title: conference.name,
          startTime: conference.startDate,
        },
      })
      if (event) {
        await prisma.internalEvent.delete({ where: { id: event.id } }).catch(() => {})
      }
    }

    await prisma.conference.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to delete conference:", error)
    return NextResponse.json({ error: "Failed to delete conference" }, { status: 500 })
  }
}
