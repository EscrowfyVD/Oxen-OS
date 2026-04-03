import { NextResponse } from "next/server"
import { createAutoTicket } from "@/lib/support-auto"

export async function POST(request: Request) {
  // Auth: verify webhook secret
  const secret = request.headers.get("x-webhook-secret")
  if (!secret || secret !== process.env.SUPPORT_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { name, email, subject, message, category, source } = body

    // Validate required fields
    if (!name || !email || !subject || !message) {
      return NextResponse.json(
        { error: "name, email, subject, and message are required" },
        { status: 400 }
      )
    }

    const result = await createAutoTicket({
      subject,
      clientName: name,
      clientEmail: email,
      channel: "live_chat",
      category: category || null,
      message,
      source: source || "website_form",
    })

    return NextResponse.json({
      success: true,
      ticketId: result.ticket.id,
      ticketRef: result.ticket.id.slice(-8).toUpperCase(),
      slaResponse: result.slaLabel,
    })
  } catch (error) {
    console.error("Website form webhook error:", error)
    return NextResponse.json({ error: "Failed to create ticket" }, { status: 500 })
  }
}
