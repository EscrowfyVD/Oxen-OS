import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Get all distinct calendar owners from events
  const owners = await prisma.calendarEvent.findMany({
    select: { calendarOwner: true },
    distinct: ["calendarOwner"],
  })

  // Get user info for each owner
  const ownerEmails = owners.map((o) => o.calendarOwner)
  const users = await prisma.user.findMany({
    where: { email: { in: ownerEmails } },
    select: { email: true, name: true, image: true },
  })

  const userMap = new Map(users.map((u) => [u.email, u]))

  const result = ownerEmails.map((email) => {
    const user = userMap.get(email)
    return {
      email,
      name: user?.name ?? email.split("@")[0],
      image: user?.image ?? null,
    }
  })

  return NextResponse.json({ owners: result })
}
