import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST() {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const year = new Date().getFullYear()

  const employees = await prisma.employee.findMany({
    where: { isActive: true },
    select: { id: true },
  })

  if (employees.length === 0) {
    return NextResponse.json({ message: "No active employees found" }, { status: 200 })
  }

  const result = await prisma.leaveBalance.createMany({
    data: employees.map((emp) => ({
      employeeId: emp.id,
      year,
      vacationTotal: 25,
      vacationUsed: 0,
      vacationPending: 0,
      sickTotal: 10,
      sickUsed: 0,
      oooTotal: 15,
      oooUsed: 0,
    })),
    skipDuplicates: true,
  })

  return NextResponse.json(
    { message: `Initialized balances for ${result.count} employees for ${year}` },
    { status: 201 }
  )
}
