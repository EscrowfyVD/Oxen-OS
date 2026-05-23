// POST /api/oca/sessions/[id]/messages — proxy for OCA's
// POST /api/admin/sessions/:id/messages (operator-authored message).
//
// Body schema: { message: string (1-5000) }. Verified Step 0 — OCA's
// REQUEST field is `message` (NOT `content`), but the RESPONSE field
// is `content`. Asymmetric by OCA design, kept verbatim here.
//
// Response (201): { id, session_id, sender: "operator", operator_email,
// content, created_at }. The composer UI uses these fields to append
// the canonical bubble after the optimistic pending one.

import { NextResponse } from "next/server"
import { proxyOcaMutation } from "@/lib/oca/proxy"
import { validateBody } from "@/lib/validate"
import { operatorMessageBodySchema } from "../_schemas"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: "Missing session id" }, { status: 400 })
  }
  const v = await validateBody(request, operatorMessageBodySchema)
  if ("error" in v) return v.error
  return proxyOcaMutation(
    "POST",
    request,
    `/api/admin/sessions/${encodeURIComponent(id)}/messages`,
    v.data,
  )
}
