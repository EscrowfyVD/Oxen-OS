import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/admin"
import { AVATAR_THEME_NAMES } from "@/lib/avatar"

/**
 * GET /api/migrate-avatars — One-time migration endpoint
 * 1. Maps legacy rgba avatarColor values to theme names
 * 2. Links entity strings to entityId via OrgEntity name match
 */
export async function GET() {
  const { error } = await requireRole("admin")
  if (error) return error

  const employees = await prisma.employee.findMany()
  const orgEntities = await prisma.orgEntity.findMany()

  const entityNameToId = new Map<string, string>()
  for (const oe of orgEntities) {
    entityNameToId.set(oe.name.toLowerCase(), oe.id)
  }

  let colorUpdated = 0
  let entityLinked = 0

  for (const emp of employees) {
    const updates: Record<string, unknown> = {}

    // Map legacy avatarColor to theme name
    if (!AVATAR_THEME_NAMES.includes(emp.avatarColor)) {
      // Assign round-robin based on index
      const idx = employees.indexOf(emp) % AVATAR_THEME_NAMES.length
      updates.avatarColor = AVATAR_THEME_NAMES[idx]
      colorUpdated++
    }

    // Link entity string to entityId
    if (emp.entity && !emp.entityId) {
      const matchId = entityNameToId.get(emp.entity.toLowerCase())
      if (matchId) {
        updates.entityId = matchId
        entityLinked++
      }
    }

    if (Object.keys(updates).length > 0) {
      await prisma.employee.update({
        where: { id: emp.id },
        data: updates,
      })
    }
  }

  return NextResponse.json({
    message: "Migration complete",
    colorUpdated,
    entityLinked,
    total: employees.length,
  })
}
