import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity"

export async function GET(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const dateStart = searchParams.get("dateStart")
    const dateEnd = searchParams.get("dateEnd")

    const where: Record<string, unknown> = {}

    if (status && status !== "all") {
      where.status = status
    }
    if (dateStart || dateEnd) {
      where.startDate = {}
      if (dateStart) (where.startDate as Record<string, unknown>).gte = new Date(dateStart)
      if (dateEnd) (where.startDate as Record<string, unknown>).lte = new Date(dateEnd)
    }

    const conferences = await prisma.conference.findMany({
      where,
      include: {
        attendees: {
          include: {
            employee: {
              select: { id: true, name: true },
            },
          },
        },
        report: {
          select: { id: true, rating: true },
        },
        _count: {
          select: { collectedContacts: true },
        },
      },
      orderBy: { startDate: "desc" },
    })

    return NextResponse.json({ conferences })
  } catch (error) {
    console.error("Failed to fetch conferences:", error)
    return NextResponse.json({ error: "Failed to fetch conferences" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const body = await request.json()
    const {
      name, location, startDate, endDate, country, website, description,
      status, attendees, currency, source, intelResultId, color,
    } = body

    if (!name || !startDate || !endDate) {
      return NextResponse.json(
        { error: "Missing required fields: name, location, startDate, endDate" },
        { status: 400 },
      )
    }

    const userId = session.user?.email ?? "unknown"

    const conference = await prisma.conference.create({
      data: {
        name,
        location,
        country: country ?? null,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        website: website ?? null,
        description: description ?? null,
        status: status ?? "planned",
        currency: currency || "EUR",
        color: color ?? null,
        source: source ?? "manual",
        intelResultId: intelResultId ?? null,
        createdBy: userId,
        attendees: attendees?.length
          ? {
              create: attendees.map((a: { id?: string; employeeId?: string; role?: string }) => ({
                employeeId: a.employeeId || a.id || "",
                role: a.role ?? null,
              })),
            }
          : undefined,
      },
      include: {
        attendees: {
          include: {
            employee: { select: { id: true, name: true, email: true } },
          },
        },
      },
    })

    // Create InternalEvent for the conference date range
    const attendeeEmails = conference.attendees
      .map((a) => a.employee.email)
      .filter(Boolean) as string[]

    const calendarEvent = await prisma.internalEvent.create({
      data: {
        title: `\uD83C\uDFAA ${name}`,
        startTime: new Date(startDate),
        endTime: new Date(endDate),
        location,
        attendees: attendeeEmails,
        color: "#22C55E",
        type: "conference",
        createdBy: userId,
      },
    })

    // Store calendarEventId on the conference
    const updatedConference = await prisma.conference.update({
      where: { id: conference.id },
      data: { calendarEventId: calendarEvent.id },
      include: {
        attendees: {
          include: {
            employee: { select: { id: true, name: true, email: true } },
          },
        },
      },
    })

    logActivity(
      "conference_created",
      `New conference added — ${name}`,
      userId,
      conference.id,
      `/conferences/${conference.id}`,
    )

    return NextResponse.json({ conference: updatedConference }, { status: 201 })
  } catch (error) {
    console.error("Failed to create conference:", error)
    return NextResponse.json({ error: "Failed to create conference" }, { status: 500 })
  }
}
