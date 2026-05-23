// GET /api/oca/sessions/[id] — proxy for OCA's GET /api/admin/sessions/:id.
//
// Thin path forwarder. id is encodeURIComponent'd before being
// dropped into the upstream URL (OCA session ids are cuid-format
// today — safe — but the encoding survives the day a different
// id scheme lands without re-thinking the proxy).

import { proxyOcaGet } from "@/lib/oca/proxy"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  return proxyOcaGet(
    request,
    `/api/admin/sessions/${encodeURIComponent(id)}`,
  )
}
