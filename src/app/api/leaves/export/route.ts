import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canAccess, type RoleLevel } from "@/lib/permissions"
import ExcelJS from "exceljs"

const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F1118" } }
const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 }
const TYPE_COLORS: Record<string, string> = {
  vacation: "FF4ADE80",
  sick: "FFF87171",
  ooo: "FF818CF8",
}

function formatDate(d: Date) {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
}

function autoWidth(ws: ExcelJS.Worksheet) {
  ws.columns.forEach((col) => {
    let maxLen = 10
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const len = String(cell.value ?? "").length
      if (len > maxLen) maxLen = len
    })
    col.width = Math.min(maxLen + 4, 40)
  })
}

function styleHeaders(ws: ExcelJS.Worksheet) {
  const row = ws.getRow(1)
  row.eachCell((cell) => {
    cell.fill = HEADER_FILL
    cell.font = HEADER_FONT
    cell.alignment = { vertical: "middle", horizontal: "center" }
  })
  row.height = 24
}

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const me = await prisma.employee.findFirst({
    where: { email: { equals: session.user.email, mode: "insensitive" } },
  })
  if (!me) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 })
  }

  const meRole = (me.roleLevel ?? "member") as RoleLevel
  const meIsAdmin = canAccess(meRole, "admin")

  const { searchParams } = new URL(request.url)
  const scope = searchParams.get("scope") ?? "my"
  const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()))
  const employeeId = searchParams.get("employeeId")

  if ((scope === "team" || scope === "individual") && !meIsAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const workbook = new ExcelJS.Workbook()
  workbook.creator = "Oxen OS"
  workbook.created = new Date()

  const yearStart = new Date(year, 0, 1)
  const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999)

  if (scope === "team") {
    // ── Sheet 1: All Leaves ──
    const allLeaves = await prisma.leaveRequest.findMany({
      where: {
        startDate: { gte: yearStart, lte: yearEnd },
      },
      include: {
        employee: { select: { name: true, department: true } },
        reviewedBy: { select: { name: true } },
      },
      orderBy: { startDate: "desc" },
    })

    const ws1 = workbook.addWorksheet("All Leaves")
    ws1.addRow(["Employee", "Department", "Type", "Start", "End", "Days", "Status", "Reviewer", "Review Date"])
    styleHeaders(ws1)

    for (const l of allLeaves) {
      const row = ws1.addRow([
        l.employee.name,
        l.employee.department ?? "",
        l.type.charAt(0).toUpperCase() + l.type.slice(1),
        formatDate(l.startDate),
        formatDate(l.endDate),
        l.totalDays,
        l.status.charAt(0).toUpperCase() + l.status.slice(1),
        l.reviewedBy?.name ?? "",
        l.reviewedAt ? formatDate(l.reviewedAt) : "",
      ])
      const typeColor = TYPE_COLORS[l.type]
      if (typeColor) {
        row.getCell(3).font = { color: { argb: typeColor } }
      }
    }
    autoWidth(ws1)

    // ── Sheet 2: Balances ──
    const employees = await prisma.employee.findMany({
      where: { isActive: true },
      select: { id: true, name: true, department: true },
      orderBy: { name: "asc" },
    })

    const balances = await prisma.leaveBalance.findMany({
      where: { year },
    })

    const balanceMap = new Map(balances.map((b) => [b.employeeId, b]))

    const ws2 = workbook.addWorksheet("Balances")
    ws2.addRow(["Employee", "Department", "Vac Total", "Vac Used", "Vac Pending", "Vac Remaining", "Sick Total", "Sick Used", "Sick Remaining", "OOO Total", "OOO Used", "OOO Remaining"])
    styleHeaders(ws2)

    for (const emp of employees) {
      const b = balanceMap.get(emp.id)
      if (!b) continue
      ws2.addRow([
        emp.name,
        emp.department ?? "",
        b.vacationTotal,
        b.vacationUsed,
        b.vacationPending,
        Math.max(0, b.vacationTotal - b.vacationUsed - b.vacationPending),
        b.sickTotal,
        b.sickUsed,
        Math.max(0, b.sickTotal - b.sickUsed),
        b.oooTotal,
        b.oooUsed,
        Math.max(0, b.oooTotal - b.oooUsed),
      ])
    }
    autoWidth(ws2)

    // ── Sheet 3: Monthly ──
    const ws3 = workbook.addWorksheet("Monthly")
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    ws3.addRow(["Employee", ...months])
    styleHeaders(ws3)

    for (const emp of employees) {
      const empLeaves = allLeaves.filter((l) => l.employee.name === emp.name && l.status === "approved")
      const monthlyCounts = Array(12).fill(0)
      for (const l of empLeaves) {
        const month = l.startDate.getMonth()
        monthlyCounts[month] += l.totalDays
      }
      ws3.addRow([emp.name, ...monthlyCounts])
    }
    autoWidth(ws3)

    const buffer = await workbook.xlsx.writeBuffer()
    return new Response(buffer as ArrayBuffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="team-leaves-${year}.xlsx"`,
      },
    })
  }

  // ── Individual or My scope ──
  const targetId = scope === "individual" && employeeId ? employeeId : me.id
  const targetEmp = await prisma.employee.findUnique({
    where: { id: targetId },
    select: { name: true, department: true },
  })

  const leaves = await prisma.leaveRequest.findMany({
    where: {
      employeeId: targetId,
      startDate: { gte: yearStart, lte: yearEnd },
    },
    include: {
      reviewedBy: { select: { name: true } },
    },
    orderBy: { startDate: "desc" },
  })

  const balance = await prisma.leaveBalance.findUnique({
    where: { employeeId_year: { employeeId: targetId, year } },
  })

  // Sheet 1: Leaves
  const ws1 = workbook.addWorksheet("Leaves")
  ws1.addRow(["Type", "Start", "End", "Days", "Status", "Reviewer", "Review Date", "Reason"])
  styleHeaders(ws1)

  for (const l of leaves) {
    const row = ws1.addRow([
      l.type.charAt(0).toUpperCase() + l.type.slice(1),
      formatDate(l.startDate),
      formatDate(l.endDate),
      l.totalDays,
      l.status.charAt(0).toUpperCase() + l.status.slice(1),
      l.reviewedBy?.name ?? "",
      l.reviewedAt ? formatDate(l.reviewedAt) : "",
      l.reason ?? "",
    ])
    const typeColor = TYPE_COLORS[l.type]
    if (typeColor) {
      row.getCell(1).font = { color: { argb: typeColor } }
    }
  }
  autoWidth(ws1)

  // Sheet 2: Balance
  if (balance) {
    const ws2 = workbook.addWorksheet("Balance")
    ws2.addRow(["Category", "Total", "Used", "Pending", "Remaining"])
    styleHeaders(ws2)
    ws2.addRow(["Vacation", balance.vacationTotal, balance.vacationUsed, balance.vacationPending, Math.max(0, balance.vacationTotal - balance.vacationUsed - balance.vacationPending)])
    ws2.addRow(["Sick", balance.sickTotal, balance.sickUsed, 0, Math.max(0, balance.sickTotal - balance.sickUsed)])
    ws2.addRow(["OOO", balance.oooTotal, balance.oooUsed, 0, Math.max(0, balance.oooTotal - balance.oooUsed)])
    autoWidth(ws2)
  }

  const name = targetEmp?.name?.replace(/\s+/g, "-") ?? "employee"
  const buffer = await workbook.xlsx.writeBuffer()
  return new Response(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${name}-leaves-${year}.xlsx"`,
    },
  })
}
