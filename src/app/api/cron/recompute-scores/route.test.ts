/**
 * Tests for POST /api/cron/recompute-scores (Sprint 3c B5).
 *
 * Mirrors the pattern from /api/cron/signal-decay/route.test.ts —
 * mock the runner, exercise the CRON_SECRET auth gates, assert the
 * response shape.
 */

import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterAll,
  beforeAll,
} from "vitest"

vi.mock("@/lib/scoring/score-recompute-runner", () => ({
  runScoreRecompute: vi.fn(),
}))

import { POST } from "./route"
import { runScoreRecompute } from "@/lib/scoring/score-recompute-runner"

const SECRET = "test-cron-secret-32-bytes-deadbeef-cafe"

function makeReq(opts: { token?: string | null } = {}) {
  const headers = new Headers({ "content-type": "application/json" })
  if (opts.token !== null) {
    headers.set("authorization", `Bearer ${opts.token ?? SECRET}`)
  }
  return new Request("http://localhost/api/cron/recompute-scores", {
    method: "POST",
    headers,
  })
}

describe("POST /api/cron/recompute-scores", () => {
  const ORIGINAL_SECRET = process.env.CRON_SECRET

  beforeAll(() => {
    process.env.CRON_SECRET = SECRET
  })

  afterAll(() => {
    if (ORIGINAL_SECRET === undefined) delete process.env.CRON_SECRET
    else process.env.CRON_SECRET = ORIGINAL_SECRET
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("[1] 503 when CRON_SECRET is unset (refuse to run unauth)", async () => {
    delete process.env.CRON_SECRET
    const res = await POST(makeReq())
    expect(res.status).toBe(503)
    process.env.CRON_SECRET = SECRET
  })

  it("[2] 401 when authorization header is missing", async () => {
    const res = await POST(makeReq({ token: null }))
    expect(res.status).toBe(401)
  })

  it("[3] 401 when bearer token does not match (timing-safe compare)", async () => {
    const res = await POST(makeReq({ token: "wrong-secret" }))
    expect(res.status).toBe(401)
  })

  it("[4] 200 + runner result on valid bearer", async () => {
    vi.mocked(runScoreRecompute).mockResolvedValue({
      processed: 10,
      promoted: 2,
      errors: [],
    })
    const res = await POST(makeReq())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.processed).toBe(10)
    expect(body.promoted).toBe(2)
    expect(typeof body.durationMs).toBe("number")
  })

  it("[5] 500 when runner throws", async () => {
    vi.mocked(runScoreRecompute).mockRejectedValue(new Error("DB outage"))
    const res = await POST(makeReq())
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe("DB outage")
  })
})
