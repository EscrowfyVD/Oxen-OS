// GET /api/oca/sessions — proxy for OCA's GET /api/admin/sessions.
//
// All gating + auth + error mapping lives in src/lib/oca/proxy.ts.
// This handler is a thin path + query forwarder. Filter params
// (platform, status, entity_type, page, limit) flow through verbatim
// — OCA enforces its own validation upstream and returns 400s that
// the proxy passes back.

import { proxyOcaGet } from "@/lib/oca/proxy"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  return proxyOcaGet(request, "/api/admin/sessions", searchParams)
}
