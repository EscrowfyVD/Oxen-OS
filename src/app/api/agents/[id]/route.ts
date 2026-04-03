import { NextResponse } from "next/server"

const message = { error: "Deprecated: use /api/crm/contacts/[id]" }

export async function GET() {
  return NextResponse.json(message, { status: 410 })
}

export async function PATCH() {
  return NextResponse.json(message, { status: 410 })
}

export async function DELETE() {
  return NextResponse.json(message, { status: 410 })
}
