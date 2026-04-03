import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"

export async function POST(request: Request) {
  const { error, session } = await requirePageAccess("finance")
  if (error) return error

  const body = await request.json()
  const { entries } = body as {
    entries: Array<{
      type: string; category: string; description?: string; amount: number
      currency?: string; date: string; entity?: string; paymentSource?: string
      reference?: string; notes?: string
    }>
  }

  if (!Array.isArray(entries) || entries.length === 0) {
    return NextResponse.json({ error: "No entries provided" }, { status: 400 })
  }

  const userId = session.user?.id ?? session.user?.email ?? "unknown"
  const results = { success: 0, failed: 0, errors: [] as string[] }

  for (const entry of entries) {
    if (!entry.type || !entry.category || entry.amount == null || !entry.date) {
      results.failed++
      results.errors.push(`Missing required fields: ${JSON.stringify(entry).slice(0, 80)}`)
      continue
    }
    try {
      const amt = typeof entry.amount === "string" ? parseFloat(entry.amount) : entry.amount
      await prisma.financeTransaction.create({
        data: {
          type: entry.type,
          category: entry.category,
          description: entry.description || null,
          amount: amt,
          currency: entry.currency || "EUR",
          amountEur: amt,
          date: new Date(entry.date),
          entity: entry.entity || "oxen",
          paymentSource: entry.paymentSource || null,
          reference: entry.reference || null,
          notes: entry.notes || null,
          createdBy: userId,
        },
      })
      results.success++
    } catch (err) {
      results.failed++
      results.errors.push(`Error: ${err instanceof Error ? err.message : "Unknown"}`)
    }
  }

  return NextResponse.json({ results })
}
