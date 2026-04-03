import { NextResponse } from "next/server"

const message = { error: "Deprecated: use /api/crm/contacts/[id]/activities" }

export async function GET() {
  return NextResponse.json(message, { status: 410 })
}

export async function POST() {
  return NextResponse.json(message, { status: 410 })
}
