// POST /api/oca/sessions/[id]/reopen — proxy for OCA's
// POST /api/admin/sessions/:id/reopen (SP15-005).
//
// Status-only transition `rejected -> review`. OCA returns 409 with
// `{ statusCode: 409, error: "Conflict", session_status: <current> }`
// when called on a non-rejected session — the SP16-003 UI gates the
// button to status=rejected, so the 409 path is unreachable from a
// correctly-rendered page, but the proxy still maps it cleanly for
// the race-condition case (status changed in another tab).
//
// Body is an empty object (Fastify rejects a truly empty body with
// content-type:application/json; the empty-object placeholder
// satisfies both sides).
//
// Response (200): { session_id, previous_status, new_status,
// reopened_at }.

import { NextResponse } from "next/server"
import { proxyOcaMutation } from "@/lib/oca/proxy"
import { validateBody } from "@/lib/validate"
import { reopenBodySchema } from "../_schemas"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: "Missing session id" }, { status: 400 })
  }
  const v = await validateBody(request, reopenBodySchema)
  if ("error" in v) return v.error
  return proxyOcaMutation(
    "POST",
    request,
    `/api/admin/sessions/${encodeURIComponent(id)}/reopen`,
    v.data,
  )
}
