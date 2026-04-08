import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"

function escapeCsvValue(value: string | null | undefined): string {
  if (value == null) return ""
  const str = String(value)
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

// GET /api/crm/outreach/suppression/export — export all suppression entries as CSV
export async function GET() {
  const { error } = await requirePageAccess("crm")
  if (error) return error

  try {
    const entries = await prisma.suppressionEntry.findMany({
      orderBy: { createdAt: "desc" },
    })

    const headerRow = "email,reason,source,addedBy,createdAt"

    const dataRows = entries.map((entry) => {
      const values = [
        escapeCsvValue(entry.email),
        escapeCsvValue(entry.reason),
        escapeCsvValue(entry.source),
        escapeCsvValue(entry.addedBy),
        escapeCsvValue(entry.createdAt.toISOString()),
      ]
      return values.join(",")
    })

    const csv = [headerRow, ...dataRows].join("\n")
    const today = new Date().toISOString().split("T")[0]

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="suppression-list-${today}.csv"`,
      },
    })
  } catch (err) {
    console.error("[Suppression Export]", err)
    return NextResponse.json({ error: "Failed to export suppression list" }, { status: 500 })
  }
}
