import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const existing = await prisma.financeEntry.count()
  if (existing > 0) {
    return NextResponse.json({ message: "Data already exists", count: existing })
  }

  const userId = session.user?.id ?? session.user?.email ?? "unknown"
  const entries: Array<{
    type: string
    category: string
    description: string
    amount: number
    currency: string
    date: Date
    entity: string
    recurring: boolean
    notes: string | null
    createdBy: string
  }> = []

  // Generate 12 months of data (Mar 2025 → Feb 2026)
  for (let i = 0; i < 12; i++) {
    const d = new Date(2025, 2 + i, 1) // Start from March 2025

    // Revenue entries
    entries.push(
      { type: "revenue", category: "client_fees", description: "Monthly client processing fees", amount: 42000 + Math.round(Math.random() * 15000), currency: "EUR", date: d, entity: "oxen", recurring: true, notes: null, createdBy: userId },
      { type: "revenue", category: "exchange_spread", description: "FX spread income", amount: 18000 + Math.round(Math.random() * 8000), currency: "EUR", date: d, entity: "oxen", recurring: true, notes: null, createdBy: userId },
      { type: "revenue", category: "card_interchange", description: "Card interchange fees", amount: 8000 + Math.round(Math.random() * 4000), currency: "EUR", date: d, entity: "oxen", recurring: true, notes: null, createdBy: userId },
      { type: "revenue", category: "other_revenue", description: "Miscellaneous revenue", amount: 2000 + Math.round(Math.random() * 3000), currency: "EUR", date: d, entity: "oxen", recurring: false, notes: null, createdBy: userId },
    )

    // Expense entries
    entries.push(
      { type: "expense", category: "salaries", description: "Team payroll", amount: 28000 + Math.round(Math.random() * 2000), currency: "EUR", date: d, entity: "oxen", recurring: true, notes: null, createdBy: userId },
      { type: "expense", category: "office", description: "Office rent & utilities", amount: 4500, currency: "EUR", date: d, entity: "oxen", recurring: true, notes: null, createdBy: userId },
      { type: "expense", category: "tech_infra", description: "Cloud, servers, SaaS tools", amount: 6000 + Math.round(Math.random() * 2000), currency: "EUR", date: d, entity: "oxen", recurring: true, notes: null, createdBy: userId },
      { type: "expense", category: "legal", description: "Legal counsel retainer", amount: 3500 + Math.round(Math.random() * 1500), currency: "EUR", date: d, entity: "oxen", recurring: true, notes: null, createdBy: userId },
      { type: "expense", category: "compliance", description: "AML/KYC compliance costs", amount: 2500 + Math.round(Math.random() * 1000), currency: "EUR", date: d, entity: "oxen", recurring: true, notes: null, createdBy: userId },
      { type: "expense", category: "marketing", description: "Marketing & events", amount: 3000 + Math.round(Math.random() * 2000), currency: "EUR", date: d, entity: "oxen", recurring: false, notes: null, createdBy: userId },
      { type: "expense", category: "travel", description: "Business travel", amount: 1500 + Math.round(Math.random() * 2500), currency: "EUR", date: d, entity: "oxen", recurring: false, notes: null, createdBy: userId },
      { type: "expense", category: "licenses", description: "Software licenses", amount: 1800 + Math.round(Math.random() * 500), currency: "EUR", date: d, entity: "oxen", recurring: true, notes: null, createdBy: userId },
      { type: "expense", category: "contractors", description: "External contractors", amount: 5000 + Math.round(Math.random() * 3000), currency: "EUR", date: d, entity: "oxen", recurring: false, notes: null, createdBy: userId },
    )

    // Budget entries for each expense category
    entries.push(
      { type: "budget", category: "salaries", description: "Salary budget", amount: 30000, currency: "EUR", date: d, entity: "oxen", recurring: false, notes: null, createdBy: userId },
      { type: "budget", category: "office", description: "Office budget", amount: 5000, currency: "EUR", date: d, entity: "oxen", recurring: false, notes: null, createdBy: userId },
      { type: "budget", category: "tech_infra", description: "Tech budget", amount: 7000, currency: "EUR", date: d, entity: "oxen", recurring: false, notes: null, createdBy: userId },
      { type: "budget", category: "legal", description: "Legal budget", amount: 4500, currency: "EUR", date: d, entity: "oxen", recurring: false, notes: null, createdBy: userId },
      { type: "budget", category: "compliance", description: "Compliance budget", amount: 3000, currency: "EUR", date: d, entity: "oxen", recurring: false, notes: null, createdBy: userId },
      { type: "budget", category: "marketing", description: "Marketing budget", amount: 4000, currency: "EUR", date: d, entity: "oxen", recurring: false, notes: null, createdBy: userId },
      { type: "budget", category: "travel", description: "Travel budget", amount: 3000, currency: "EUR", date: d, entity: "oxen", recurring: false, notes: null, createdBy: userId },
      { type: "budget", category: "licenses", description: "License budget", amount: 2000, currency: "EUR", date: d, entity: "oxen", recurring: false, notes: null, createdBy: userId },
      { type: "budget", category: "contractors", description: "Contractor budget", amount: 6000, currency: "EUR", date: d, entity: "oxen", recurring: false, notes: null, createdBy: userId },
    )
  }

  // Add some Escrowfy revenue
  for (let i = 0; i < 12; i++) {
    const d = new Date(2025, 2 + i, 1)
    entries.push(
      { type: "revenue", category: "client_fees", description: "Escrowfy escrow fees", amount: 12000 + Math.round(Math.random() * 5000), currency: "EUR", date: d, entity: "escrowfy", recurring: true, notes: null, createdBy: userId },
    )
  }

  await prisma.financeEntry.createMany({ data: entries })

  // Seed goals
  await prisma.financeGoal.createMany({
    data: [
      { metric: "monthly_revenue", target: 80000, entity: "oxen", period: "2026-03", createdBy: userId },
      { metric: "monthly_expense", target: 60000, entity: "oxen", period: "2026-03", createdBy: userId },
      { metric: "profit_margin", target: 25, entity: "oxen", period: "2026-Q1", createdBy: userId },
      { metric: "runway_months", target: 18, entity: "oxen", period: "2026-Q1", createdBy: userId },
    ],
  })

  return NextResponse.json({ success: true, entries: entries.length, goals: 4 })
}
