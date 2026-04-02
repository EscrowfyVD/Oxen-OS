import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

/* ── GET: fetch balance for an employee ── */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { employeeId } = await params
  const { searchParams } = new URL(request.url)
  const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()))

  // Check permissions
  const me = await prisma.employee.findFirst({
    where: { email: { equals: session.user.email, mode: "insensitive" } },
  })
  if (!me) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 })
  }
  if (!me.isAdmin && me.id !== employeeId) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 })
  }

  // Find or create balance
  let balance = await prisma.leaveBalance.findUnique({
    where: { employeeId_year: { employeeId, year } },
  })
  if (!balance) {
    balance = await prisma.leaveBalance.create({
      data: { employeeId, year },
    })
  }

  return NextResponse.json({ balance })
}

/* ── PATCH: admin edits quotas ── */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { employeeId } = await params

  // Admin check
  const me = await prisma.employee.findFirst({
    where: { email: { equals: session.user.email, mode: "insensitive" } },
  })
  if (!me?.isAdmin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 })
  }

  const body = await request.json()
  const { vacationTotal, vacationUsed, sickTotal, sickUsed, oooTotal, oooUsed, year: bodyYear, auditNote } = body
  const year = bodyYear ?? new Date().getFullYear()

  const data: Record<string, unknown> = {}
  if (vacationTotal !== undefined) data.vacationTotal = vacationTotal
  if (vacationUsed !== undefined) data.vacationUsed = vacationUsed
  if (sickTotal !== undefined) data.sickTotal = sickTotal
  if (sickUsed !== undefined) data.sickUsed = sickUsed
  if (oooTotal !== undefined) data.oooTotal = oooTotal
  if (oooUsed !== undefined) data.oooUsed = oooUsed

  // Upsert balance
  const balance = await prisma.leaveBalance.upsert({
    where: { employeeId_year: { employeeId, year } },
    create: {
      employeeId,
      year,
      ...data,
    },
    update: data,
  })

  // Log the activity if there's an audit note
  if (auditNote) {
    try {
      const { logActivity } = await import("@/lib/activity")
      logActivity(
        "leave_balance_adjusted",
        `Balance adjusted: ${auditNote}`,
        me.id,
        employeeId,
      )
    } catch { /* activity log is optional */ }
  }

  return NextResponse.json({ balance })
}
