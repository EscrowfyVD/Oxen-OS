import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ intelResultId: string }> },
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { intelResultId } = await params
    const body = await request.json()
    const {
      name, location, country, startDate, endDate, website, description, attendees,
    } = body

    const userId = session.user?.email ?? "unknown"

    // Get IntelResult
    const intelResult = await prisma.intelResult.findUnique({
      where: { id: intelResultId },
    })
    if (!intelResult) {
      return NextResponse.json({ error: "Intel result not found" }, { status: 404 })
    }

    const metadata = (intelResult.metadata as Record<string, unknown>) ?? {}

    const confName = name ?? (metadata.name ?? metadata.title ?? intelResult.title) as string
    const confLocation = location ?? (metadata.location ?? "TBD") as string
    const confStartDate = startDate
      ? new Date(startDate)
      : metadata.startDate
        ? new Date(metadata.startDate as string)
        : new Date()
    const confEndDate = endDate
      ? new Date(endDate)
      : metadata.endDate
        ? new Date(metadata.endDate as string)
        : confStartDate
    const confWebsite = website ?? (metadata.website ?? metadata.url ?? null) as string | null
    const confDescription = description ?? intelResult.summary ?? null
    const confCountry = country ?? (metadata.country ?? null) as string | null

    // Create Conference
    const conference = await prisma.conference.create({
      data: {
        name: confName,
        location: confLocation,
        country: confCountry,
        startDate: confStartDate,
        endDate: confEndDate,
        website: confWebsite,
        description: confDescription,
        source: "intel",
        intelResultId,
        createdBy: userId,
        attendees: attendees?.length
          ? {
              create: attendees.map((a: { employeeId: string; role?: string }) => ({
                employeeId: a.employeeId,
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

    // Create InternalEvent
    const attendeeEmails = conference.attendees
      .map((a) => a.employee.email)
      .filter(Boolean) as string[]

    const calendarEvent = await prisma.internalEvent.create({
      data: {
        title: `\uD83C\uDFAA ${confName}`,
        startTime: confStartDate,
        endTime: confEndDate,
        location: confLocation,
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

    // Update IntelResult metadata: accepted = true
    await prisma.intelResult.update({
      where: { id: intelResultId },
      data: {
        metadata: { ...metadata, accepted: true },
      },
    })

    logActivity(
      "conference_created",
      `Conference created from intel — ${confName}`,
      userId,
      conference.id,
      `/conferences/${conference.id}`,
    )

    return NextResponse.json({ conference: updatedConference }, { status: 201 })
  } catch (error) {
    console.error("Failed to create conference from intel:", error)
    return NextResponse.json({ error: "Failed to create conference from intel" }, { status: 500 })
  }
}
