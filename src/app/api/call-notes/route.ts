import { NextResponse } from "next/server"
import { getUserRole } from "@/lib/admin"
import { prisma } from "@/lib/prisma"
import { canAccess, type RoleLevel } from "@/lib/permissions"
import { logActivity } from "@/lib/activity"

export async function GET() {
  const { session, employee, roleLevel } = await getUserRole()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const isAdmin = canAccess(roleLevel, "admin")
  const userEmail = session.user.email ?? ""
  const userName = employee?.name ?? ""

  // Admin sees all, others see notes they created or are attendees of
  const notes = await prisma.callNote.findMany({
    ...(isAdmin
      ? {}
      : {
          where: {
            OR: [
              { createdBy: userEmail },
              { event: { attendees: { has: userEmail } } },
              ...(userName ? [{ event: { attendees: { has: userName } } }] : []),
            ],
          },
        }),
    orderBy: { date: "desc" },
    select: {
      id: true,
      title: true,
      date: true,
      createdBy: true,
      createdAt: true,
      eventId: true,
      event: {
        select: {
          id: true,
          title: true,
          startTime: true,
          attendees: true,
        },
      },
    },
  })

  return NextResponse.json({ notes })
}

export async function POST(request: Request) {
  const { session } = await getUserRole()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const { title, date, htmlContent, noteData, eventId } = body

  if (!title || !date || !htmlContent) {
    return NextResponse.json(
      { error: "Missing required fields: title, date, htmlContent" },
      { status: 400 }
    )
  }

  const userId = session!.user?.id ?? session!.user?.email ?? "unknown"

  const note = await prisma.callNote.create({
    data: {
      title,
      date: new Date(date),
      htmlContent,
      noteData: noteData ?? null,
      eventId: eventId ?? null,
      createdBy: userId,
    },
  })

  logActivity("meeting_summary", `Team meeting summary available — ${title}`, userId, note.id, `/calendar`)

  return NextResponse.json({ note }, { status: 201 })
}
