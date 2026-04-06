import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { sendTelegramNotification } from "@/lib/telegram"
import { canAccess, type RoleLevel } from "@/lib/permissions"

/* ── PATCH: approve / reject / cancel ── */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()
  const { status, reviewNote } = body

  if (!status || !["approved", "rejected"].includes(status)) {
    return NextResponse.json({ error: "Invalid status. Must be 'approved' or 'rejected'" }, { status: 400 })
  }

  const existing = await prisma.leaveRequest.findUnique({
    where: { id },
    include: { employee: { select: { id: true, name: true } } },
  })
  if (!existing) {
    return NextResponse.json({ error: "Leave request not found" }, { status: 404 })
  }
  if (existing.status !== "pending") {
    return NextResponse.json({ error: "Can only approve/reject pending requests" }, { status: 400 })
  }

  // Find reviewer — must be admin+
  const reviewer = await prisma.employee.findFirst({
    where: { email: { equals: session.user.email, mode: "insensitive" } },
  })
  const reviewerRole = (reviewer?.roleLevel ?? "member") as RoleLevel
  if (!reviewer || !canAccess(reviewerRole, "admin")) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 })
  }

  const year = existing.startDate.getFullYear()
  const type = existing.type
  const totalDays = existing.totalDays

  // Update the leave request
  const updated = await prisma.leaveRequest.update({
    where: { id },
    data: {
      status,
      reviewedById: reviewer.id,
      reviewedAt: new Date(),
      reviewNote: reviewNote ?? null,
    },
    include: {
      employee: {
        select: { id: true, name: true, initials: true, avatarColor: true, department: true },
      },
      reviewedBy: { select: { name: true } },
    },
  })

  // Update balance
  if (status === "approved") {
    // For vacation: move from pending to used
    if (type === "vacation") {
      await prisma.leaveBalance.update({
        where: { employeeId_year: { employeeId: existing.employeeId, year } },
        data: {
          vacationPending: { decrement: totalDays },
          vacationUsed: { increment: totalDays },
        },
      })
    }
    // sick and ooo already incremented used on creation — no change needed
  } else if (status === "rejected") {
    // Reverse the balance changes
    if (type === "vacation") {
      await prisma.leaveBalance.update({
        where: { employeeId_year: { employeeId: existing.employeeId, year } },
        data: { vacationPending: { decrement: totalDays } },
      })
    } else if (type === "sick") {
      await prisma.leaveBalance.update({
        where: { employeeId_year: { employeeId: existing.employeeId, year } },
        data: { sickUsed: { decrement: totalDays } },
      })
    } else if (type === "ooo") {
      await prisma.leaveBalance.update({
        where: { employeeId_year: { employeeId: existing.employeeId, year } },
        data: { oooUsed: { decrement: totalDays } },
      })
    }
  }

  // Notify the employee via Telegram
  try {
    const formatDate = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
    if (status === "approved") {
      const msg = `✅ <b>Leave Approved</b>\n\nYour ${type} leave from ${formatDate(existing.startDate)} to ${formatDate(existing.endDate)} has been approved by ${reviewer.name}.`
      sendTelegramNotification(existing.employeeId, msg).catch(() => {})
    } else {
      const msg = `❌ <b>Leave Rejected</b>\n\nYour ${type} leave from ${formatDate(existing.startDate)} to ${formatDate(existing.endDate)} was not approved.${reviewNote ? `\nNote: ${reviewNote}` : ""}`
      sendTelegramNotification(existing.employeeId, msg).catch(() => {})
    }
  } catch { /* silent */ }

  return NextResponse.json({ request: updated })
}

/* ── DELETE: delete a leave request ── */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  const existing = await prisma.leaveRequest.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: "Leave request not found" }, { status: 404 })
  }

  // Check permissions: admin or own pending request
  const me = await prisma.employee.findFirst({
    where: { email: { equals: session.user.email, mode: "insensitive" } },
  })
  if (!me) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 })
  }

  const isOwn = existing.employeeId === me.id
  const meRole = (me.roleLevel ?? "member") as RoleLevel
  const meIsAdmin = canAccess(meRole, "admin")
  if (!meIsAdmin && !isOwn) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 })
  }
  if (!meIsAdmin && existing.status !== "pending") {
    return NextResponse.json({ error: "Can only cancel pending requests" }, { status: 400 })
  }

  const year = existing.startDate.getFullYear()
  const type = existing.type
  const totalDays = existing.totalDays

  // Reverse balance changes
  if (existing.status === "pending") {
    if (type === "vacation") {
      await prisma.leaveBalance.update({
        where: { employeeId_year: { employeeId: existing.employeeId, year } },
        data: { vacationPending: { decrement: totalDays } },
      })
    } else if (type === "sick") {
      await prisma.leaveBalance.update({
        where: { employeeId_year: { employeeId: existing.employeeId, year } },
        data: { sickUsed: { decrement: totalDays } },
      })
    } else if (type === "ooo") {
      await prisma.leaveBalance.update({
        where: { employeeId_year: { employeeId: existing.employeeId, year } },
        data: { oooUsed: { decrement: totalDays } },
      })
    }
  } else if (existing.status === "approved") {
    if (type === "vacation") {
      await prisma.leaveBalance.update({
        where: { employeeId_year: { employeeId: existing.employeeId, year } },
        data: { vacationUsed: { decrement: totalDays } },
      })
    } else if (type === "sick") {
      await prisma.leaveBalance.update({
        where: { employeeId_year: { employeeId: existing.employeeId, year } },
        data: { sickUsed: { decrement: totalDays } },
      })
    } else if (type === "ooo") {
      await prisma.leaveBalance.update({
        where: { employeeId_year: { employeeId: existing.employeeId, year } },
        data: { oooUsed: { decrement: totalDays } },
      })
    }
  }

  await prisma.leaveRequest.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
