import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/admin"

export async function GET() {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const employees = await prisma.employee.findMany({
    include: { reports: true },
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
    entity, country, startDate, bio,
  } = body

  if (!name || !initials || !role || !department || !avatarColor) {
    return NextResponse.json(
      { error: "Missing required fields: name, initials, role, department, avatarColor" },
      { status: 400 }
    )
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
      country: country ?? null,
      startDate: startDate ? new Date(startDate) : null,
      bio: bio ?? null,
      avatarColor,
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
