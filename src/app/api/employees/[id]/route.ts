import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()
  const {
    name, initials, role, department, location, email, phone,
    telegram, telegramChatId, whatsapp, timezone, workHours, entity, country,
    startDate, bio, avatarColor, managerId, order, isActive,
  } = body

  const existing = await prisma.employee.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 })
  }

  const employee = await prisma.employee.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(initials !== undefined && { initials }),
      ...(role !== undefined && { role }),
      ...(department !== undefined && { department }),
      ...(location !== undefined && { location }),
      ...(email !== undefined && { email }),
      ...(phone !== undefined && { phone }),
      ...(telegram !== undefined && { telegram }),
      ...(telegramChatId !== undefined && { telegramChatId }),
      ...(whatsapp !== undefined && { whatsapp }),
      ...(timezone !== undefined && { timezone }),
      ...(workHours !== undefined && { workHours }),
      ...(entity !== undefined && { entity }),
      ...(country !== undefined && { country }),
      ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
      ...(bio !== undefined && { bio }),
      ...(avatarColor !== undefined && { avatarColor }),
      ...(managerId !== undefined && { managerId }),
      ...(order !== undefined && { order }),
      ...(isActive !== undefined && { isActive }),
    },
  })

  return NextResponse.json({ employee })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  const existing = await prisma.employee.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 })
  }

  await prisma.employee.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
