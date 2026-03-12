import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

/**
 * Require the current user to be an admin (isAdmin === true on their Employee record).
 * Returns { error, session, employee }.
 * If error is non-null, return it from your route handler immediately.
 */
export async function requireAdmin() {
  const session = await auth()
  if (!session?.user) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      session: null,
      employee: null,
    }
  }

  const userEmail = session.user.email
  if (!userEmail) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      session,
      employee: null,
    }
  }

  const employee = await prisma.employee.findFirst({
    where: { email: { equals: userEmail, mode: "insensitive" } },
    select: { id: true, name: true, email: true, isAdmin: true },
  })

  if (!employee?.isAdmin) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      session,
      employee: null,
    }
  }

  return { error: null, session, employee }
}
