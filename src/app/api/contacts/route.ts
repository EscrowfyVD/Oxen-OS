import { NextResponse } from "next/server"

const message = { error: "Deprecated: use /api/crm/contacts" }

export async function GET() {
  return NextResponse.json(message, { status: 410 })
}

export async function POST() {
  return NextResponse.json(message, { status: 410 })
}
