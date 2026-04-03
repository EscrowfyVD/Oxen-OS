import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"

const INBOX_ACTIVITY_TYPES = [
  "email_received",
  "meeting_calendly",
  "whatsapp_message",
  "clay_sequence_event",
]

export async function GET(request: Request) {
  const { error } = await requirePageAccess("crm")
  if (error) return error

  const { searchParams } = new URL(request.url)
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10)))

  const activities = await prisma.activity.findMany({
    where: {
      type: { in: INBOX_ACTIVITY_TYPES },
    },
    include: {
      contact: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          jobTitle: true,
          company: { select: { id: true, name: true } },
        },
      },
      deal: {
        select: { id: true, dealName: true, stage: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  })

  return NextResponse.json({ activities })
}
