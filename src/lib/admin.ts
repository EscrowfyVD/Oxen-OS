import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { type RoleLevel, canAccess, canAccessPage } from "@/lib/permissions"

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
    select: { id: true, name: true, email: true, isAdmin: true, roleLevel: true },
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

/**
 * Require the current user to have at least the specified role level.
 */
export async function requireRole(minRole: RoleLevel) {
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
    select: { id: true, name: true, email: true, isAdmin: true, roleLevel: true, managerId: true, department: true },
  })

  const userRole = (employee?.roleLevel ?? "member") as RoleLevel

  if (!canAccess(userRole, minRole)) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      session,
      employee: null,
    }
  }

  return { error: null, session, employee }
}

/**
 * Require the current user to have access to a page/feature based on role + department rules.
 */
export async function requirePageAccess(pageKey: string) {
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
    select: { id: true, name: true, email: true, isAdmin: true, roleLevel: true, managerId: true, department: true },
  })

  const userRole = (employee?.roleLevel ?? "member") as RoleLevel
  const userDept = employee?.department ?? null

  if (!canAccessPage(userRole, userDept, pageKey)) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      session,
      employee: null,
    }
  }

  return { error: null, session, employee }
}

/**
 * Get the current user's role level without enforcing any requirement.
 */
export async function getUserRole() {
  const session = await auth()
  if (!session?.user?.email) {
    return { session, employee: null, roleLevel: "member" as RoleLevel }
  }

  const employee = await prisma.employee.findFirst({
    where: { email: { equals: session.user.email, mode: "insensitive" } },
    select: { id: true, name: true, email: true, isAdmin: true, roleLevel: true, managerId: true, department: true },
  })

  return {
    session,
    employee,
    roleLevel: (employee?.roleLevel ?? "member") as RoleLevel,
  }
}
