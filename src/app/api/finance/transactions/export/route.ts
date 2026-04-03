import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"

export async function GET(request: Request) {
  const { error } = await requirePageAccess("finance")
  if (error) return error

  const { searchParams } = new URL(request.url)
  const entity = searchParams.get("entity")
  const dateFrom = searchParams.get("dateFrom")
  const dateTo = searchParams.get("dateTo")
  const type = searchParams.get("type")

  const where: Record<string, unknown> = {}
  if (entity && entity !== "all") where.entity = entity
  if (type) where.type = type
  if (dateFrom || dateTo) {
    where.date = {
      ...(dateFrom && { gte: new Date(dateFrom) }),
      ...(dateTo && { lte: new Date(dateTo + "T23:59:59Z") }),
    }
  }

  const transactions = await prisma.financeTransaction.findMany({
    where,
    orderBy: { date: "desc" },
    include: { contact: { select: { firstName: true, lastName: true, company: { select: { id: true, name: true } } } } },
  })

  const headers = [
    "Date", "Type", "Category", "Description", "Amount", "Currency",
    "Amount (EUR)", "Entity", "Payment Source", "Reference", "Status",
    "Contact", "Notes",
  ]

  const rows = transactions.map((t) => [
    t.date.toISOString().split("T")[0],
    t.type,
    t.category,
    (t.description || "").replace(/,/g, ";"),
    t.amount,
    t.currency,
    t.amountEur ?? t.amount,
    t.entity,
    t.paymentSource || "",
    t.reference || "",
    t.status,
    t.contact ? `${t.contact.firstName} ${t.contact.lastName}` : "",
    (t.notes || "").replace(/,/g, ";").replace(/\n/g, " "),
  ])

  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n")

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="transactions_${new Date().toISOString().split("T")[0]}.csv"`,
    },
  })
}
