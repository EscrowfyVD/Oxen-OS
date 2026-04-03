import { NextResponse } from "next/server"

export async function PATCH() {
  return NextResponse.json({ error: "Deprecated: use /api/crm/contacts/[id] with introducerId field" }, { status: 410 })
}
