// PATCH /api/oca/sessions/[id]/agent — proxy for OCA's
// PATCH /api/admin/sessions/:id/agent (takeover / hand-back).
//
// Body schema: { active: boolean }. Verified Step 0 (the only field
// OCA accepts — `agentActive` and `agent_active` both 400).
//
// All gating + auth + error mapping lives in src/lib/oca/proxy.ts.
// Idempotency: OCA returns `{ ..., changed: false }` when the
// requested state matches the current one. Callers can rely on that
// flag instead of reading agent_active before patching.

import { NextResponse } from "next/server"
import { proxyOcaMutation } from "@/lib/oca/proxy"
import { validateBody } from "@/lib/validate"
import { agentToggleBodySchema } from "../_schemas"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: "Missing session id" }, { status: 400 })
  }
  const v = await validateBody(request, agentToggleBodySchema)
  if ("error" in v) return v.error
  return proxyOcaMutation(
    "PATCH",
    request,
    `/api/admin/sessions/${encodeURIComponent(id)}/agent`,
    v.data,
  )
}
