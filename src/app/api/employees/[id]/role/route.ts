import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/admin"
import { ROLE_LEVELS } from "@/lib/permissions"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, employee: currentUser } = await requireRole("super_admin")
  if (error) return error

  const { id } = await params
  const body = await request.json()
  const { roleLevel } = body

  if (!roleLevel || !ROLE_LEVELS.includes(roleLevel)) {
    return NextResponse.json(
      { error: `Invalid roleLevel. Must be one of: ${ROLE_LEVELS.join(", ")}` },
      { status: 400 }
    )
  }

  // Cannot change own role
  if (currentUser!.id === id) {
    return NextResponse.json({ error: "Cannot change your own role" }, { status: 400 })
  }

  const target = await prisma.employee.findUnique({ where: { id } })
  if (!target) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 })
  }

  // Sync isAdmin with roleLevel
  const isAdmin = roleLevel === "super_admin" || roleLevel === "admin"

  const updated = await prisma.employee.update({
    where: { id },
    data: { roleLevel, isAdmin },
    select: { id: true, name: true, email: true, roleLevel: true, isAdmin: true },
  })

  return NextResponse.json({ employee: updated })
}
