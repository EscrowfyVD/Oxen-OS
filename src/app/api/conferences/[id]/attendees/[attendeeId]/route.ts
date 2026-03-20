import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

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
