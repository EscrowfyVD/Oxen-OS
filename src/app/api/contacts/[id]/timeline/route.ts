import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json({ error: "Deprecated: use /api/crm/contacts/[id]/activities" }, { status: 410 })
}
