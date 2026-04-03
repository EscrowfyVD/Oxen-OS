import { NextResponse } from "next/server"

// CustomerMetrics model removed in CRM v2 — metrics are now tracked via Deal + Activity
export async function POST() {
  return NextResponse.json({ error: "Deprecated: use /api/crm/deals and /api/crm/contacts/[id]/activities" }, { status: 410 })
}
