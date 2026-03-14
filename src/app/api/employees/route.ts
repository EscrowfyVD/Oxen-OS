import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/admin"
import { getLeastUsedTheme } from "@/lib/avatar"

export async function GET() {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const employees = await prisma.employee.findMany({
    include: { reports: true, orgEntity: { select: { id: true, name: true } } },
    orderBy: { order: "asc" },
  })

  return NextResponse.json({ employees })
}

export async function POST(request: Request) {
  const { error } = await requireRole("admin")
  if (error) return error

  const body = await request.json()
  const {
    name, initials, role, department, location, email, avatarColor,
    managerId, order, phone, telegram, telegramChatId, whatsapp, timezone, workHours,
    entity, entityId, country, startDate, bio, icon,
  } = body

  if (!name || !initials || !role || !department) {
    return NextResponse.json(
      { error: "Missing required fields: name, initials, role, department" },
      { status: 400 }
    )
  }

  // Auto-assign avatar color if not provided
  let finalColor = avatarColor
  if (!finalColor) {
    const existing = await prisma.employee.findMany({ select: { avatarColor: true } })
    finalColor = getLeastUsedTheme(existing.map((e) => e.avatarColor))
  }

  const employee = await prisma.employee.create({
    data: {
      name,
      initials,
      role,
      department,
      location: location ?? null,
      email: email ?? null,
      phone: phone ?? null,
      telegram: telegram ?? null,
      telegramChatId: telegramChatId ?? null,
      whatsapp: whatsapp ?? null,
      timezone: timezone ?? null,
      workHours: workHours ?? null,
      entity: entity ?? null,
      entityId: entityId ?? null,
      country: country ?? null,
      startDate: startDate ? new Date(startDate) : null,
      bio: bio ?? null,
      avatarColor: finalColor,
      icon: icon ?? null,
      managerId: managerId ?? null,
      order: order ?? 0,
    },
  })

  return NextResponse.json({ employee }, { status: 201 })
}

export async function PATCH(request: Request) {
  const { error } = await requireRole("admin")
  if (error) return error

  const body = await request.json()
  const { id, ...data } = body

  if (!id) {
    return NextResponse.json({ error: "Missing employee id" }, { status: 400 })
  }

  const employee = await prisma.employee.update({
    where: { id },
    data,
  })

  return NextResponse.json({ employee })
}
