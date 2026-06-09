/**
 * Tests for POST /api/webhooks/apify/[category] (Apify PR1 — webhook MVP).
 *
 * Scope = receive → persist a Job → 200. Mocks prisma (job.create). The key
 * guarantee: NEVER 500 (a 5xx makes Apify retry-storm) — bad token → 401,
 * anything else → 200.
 */

import { describe, it, expect, vi, afterAll, beforeEach } from "vitest"

const { TEST_TOKEN, ORIG } = vi.hoisted(() => {
  const ORIG = process.env.APIFY_WEBHOOK_SECRET
  const TEST_TOKEN = "test-apify-token-deadbeef"
  process.env.APIFY_WEBHOOK_SECRET = TEST_TOKEN
  return { TEST_TOKEN, ORIG }
})

vi.mock("@/lib/prisma", () => ({ prisma: { job: { create: vi.fn() } } }))

import { POST } from "./route"
import { prisma } from "@/lib/prisma"

// Apify's DEFAULT webhook body shape.
const OK_BODY = {
  eventType: "ACTOR.RUN.SUCCEEDED",
  resource: { defaultDatasetId: "ds_123", actId: "act_1", status: "SUCCEEDED" },
}

function makeReq(body: unknown, token: string | null = TEST_TOKEN, rawString?: string) {
  const base = "http://localhost/api/webhooks/apify/reddit-c"
  const url = token === null ? base : `${base}?token=${encodeURIComponent(token)}`
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: rawString !== undefined ? rawString : JSON.stringify(body),
  })
}

const ctx = (category = "reddit-c") => ({ params: Promise.resolve({ category }) })

type JobCreateArgs = {
  data: {
    type: string
    createdBy: string
    payload: { datasetId: string; category: string; actId: string | null; raw: unknown }
  }
}

describe("POST /api/webhooks/apify/[category]", () => {
  afterAll(() => {
    if (ORIG === undefined) delete process.env.APIFY_WEBHOOK_SECRET
    else process.env.APIFY_WEBHOOK_SECRET = ORIG
  })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.job.create).mockResolvedValue({ id: "job-1" } as never)
  })

  it("[1] valid token + ok body → Job persisted (type/payload/createdBy) + 200 queued", async () => {
    const res = await POST(makeReq(OK_BODY), ctx())
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toMatchObject({ ok: true, action: "queued", jobId: "job-1", datasetId: "ds_123" })

    expect(prisma.job.create).toHaveBeenCalledTimes(1)
    const arg = vi.mocked(prisma.job.create).mock.calls[0][0] as unknown as JobCreateArgs
    expect(arg.data.type).toBe("apify:process-dataset")
    expect(arg.data.createdBy).toBe("webhook:apify")
    expect(arg.data.payload.datasetId).toBe("ds_123")
    expect(arg.data.payload.actId).toBe("act_1")
    expect(arg.data.payload.raw).toBeTruthy() // full body stashed for the pipeline
  })

  it("[2] category from the URL suffix lands in the Job payload", async () => {
    await POST(makeReq(OK_BODY), ctx("news-d"))
    const arg = vi.mocked(prisma.job.create).mock.calls[0][0] as unknown as JobCreateArgs
    expect(arg.data.payload.category).toBe("news-d")
  })

  it("[3] bad token → 401, no Job", async () => {
    const res = await POST(makeReq(OK_BODY, "wrong"), ctx())
    expect(res.status).toBe(401)
    expect(prisma.job.create).not.toHaveBeenCalled()
  })

  it("[4] missing token → 401, no Job", async () => {
    const res = await POST(makeReq(OK_BODY, null), ctx())
    expect(res.status).toBe(401)
    expect(prisma.job.create).not.toHaveBeenCalled()
  })

  it("[5] valid token + malformed JSON body → 200 ignored, no Job, NEVER 500", async () => {
    const res = await POST(makeReq(null, TEST_TOKEN, "not-json{"), ctx())
    expect(res.status).toBe(200)
    expect((await res.json()).action).toBe("ignored_no_dataset")
    expect(prisma.job.create).not.toHaveBeenCalled()
  })

  it("[6] valid token + body without resource.defaultDatasetId → 200 ignored, no Job", async () => {
    const res = await POST(makeReq({ eventType: "ACTOR.RUN.SUCCEEDED", resource: {} }), ctx())
    expect(res.status).toBe(200)
    expect((await res.json()).action).toBe("ignored_no_dataset")
    expect(prisma.job.create).not.toHaveBeenCalled()
  })

  it("[7] job.create throws → 200 error (NEVER 500 → no Apify retry storm)", async () => {
    vi.mocked(prisma.job.create).mockRejectedValue(new Error("db down"))
    const res = await POST(makeReq(OK_BODY), ctx())
    expect(res.status).toBe(200)
    expect((await res.json()).action).toBe("error")
  })
})
