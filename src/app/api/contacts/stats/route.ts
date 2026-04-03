import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json({ error: "Deprecated: use /api/crm/reports/pipeline and /api/crm/reports/revenue" }, { status: 410 })
}
