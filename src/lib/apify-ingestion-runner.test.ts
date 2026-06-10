/**
 * Tests for runApifyIngestion (PR3a-wiring). Mocks prisma ($queryRaw claim,
 * job.findUnique/update, processedSignal.create) + the apify client. Uses the
 * REAL Prisma namespace so the P2002 dedup path is exercised with a real error.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { Prisma } from "@prisma/client"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: vi.fn(),
    job: { findUnique: vi.fn(), update: vi.fn() },
    processedSignal: { create: vi.fn() },
  },
}))
vi.mock("@/lib/apify", () => ({ fetchDatasetItems: vi.fn() }))

import { runApifyIngestion, extractSourceUrl } from "./apify-ingestion-runner"
import { prisma } from "@/lib/prisma"
import { fetchDatasetItems } from "@/lib/apify"

const JOB = {
  id: "job-1",
  payload: { datasetId: "ds_1", category: "reddit-c", actId: "act_1" },
  attempts: 1,
  maxAttempts: 3,
}

// Make claimNextJob ($queryRaw) yield the given ids once each, then [].
function queueJobs(ids: string[]) {
  let i = 0
  vi.mocked(prisma.$queryRaw).mockImplementation((async () =>
    i < ids.length ? [{ id: ids[i++] }] : []) as never)
}

const ORIG_TOKEN = process.env.APIFY_API_TOKEN

describe("runApifyIngestion", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.APIFY_API_TOKEN = "test-token" // token present → runner does NOT short-circuit
    vi.mocked(prisma.$queryRaw).mockResolvedValue([] as never) // default: no jobs
    vi.mocked(prisma.job.findUnique).mockResolvedValue(JOB as never)
    vi.mocked(prisma.job.update).mockResolvedValue({} as never)
    vi.mocked(prisma.processedSignal.create).mockResolvedValue({} as never)
    vi.mocked(fetchDatasetItems).mockResolvedValue([] as never)
  })
  afterEach(() => {
    if (ORIG_TOKEN === undefined) delete process.env.APIFY_API_TOKEN
    else process.env.APIFY_API_TOKEN = ORIG_TOKEN
  })

  it("[1] pending Job → fetch → ProcessedSignal rows w/ rawPayload; Job completed", async () => {
    queueJobs(["job-1"])
    vi.mocked(fetchDatasetItems).mockResolvedValue([{ url: "http://a", x: 1 }, { url: "http://b" }] as never)

    const res = await runApifyIngestion()
    expect(fetchDatasetItems).toHaveBeenCalledWith("ds_1")
    expect(prisma.processedSignal.create).toHaveBeenCalledTimes(2)
    const data0 = vi.mocked(prisma.processedSignal.create).mock.calls[0][0].data as Record<string, unknown>
    expect(data0).toMatchObject({ sourceUrl: "http://a", sourceActor: "act_1", signalCategory: "reddit-c" })
    expect(data0.rawPayload).toEqual({ url: "http://a", x: 1 })
    expect(res).toMatchObject({ skipped: false, jobs: 1, fetched: 2, inserted: 2, duplicates: 0, errors: 0 })

    const completed = vi
      .mocked(prisma.job.update)
      .mock.calls.find((c) => (c[0].data as { status?: string }).status === "completed")
    expect(completed).toBeTruthy()
    expect((completed![0].data as { result: unknown }).result).toMatchObject({
      fetched: 2,
      new: 2,
      dup: 0,
      errors: 0,
    })
  })

  it("[2] re-run same dataset → all dup (unique sourceUrl → P2002), no re-insert, no error", async () => {
    queueJobs(["job-1"])
    vi.mocked(fetchDatasetItems).mockResolvedValue([{ url: "http://a" }, { url: "http://b" }] as never)
    const p2002 = new Prisma.PrismaClientKnownRequestError("dup", {
      code: "P2002",
      clientVersion: "5.22.0",
    })
    vi.mocked(prisma.processedSignal.create).mockRejectedValue(p2002 as never)

    const res = await runApifyIngestion()
    expect(res).toMatchObject({ inserted: 0, duplicates: 2, errors: 0 })
  })

  it("[3] no-key → guard short-circuits BEFORE the claim: 0 Job claimed, pending Jobs untouched (NOT completed)", async () => {
    delete process.env.APIFY_API_TOKEN // no token → must skip before touching any Job
    queueJobs(["job-1"]) // a pending Job IS available — it must be left strictly alone

    const res = await runApifyIngestion()

    expect(res).toMatchObject({ skipped: true, jobs: 0, fetched: 0, inserted: 0, duplicates: 0, errors: 0 })
    expect(prisma.$queryRaw).not.toHaveBeenCalled() // never even attempted the claim
    expect(fetchDatasetItems).not.toHaveBeenCalled()
    expect(prisma.processedSignal.create).not.toHaveBeenCalled()
    expect(prisma.job.update).not.toHaveBeenCalled() // no Job marked completed/failed → stays 'pending'
  })

  it("[4] per-item error isolation — one bad insert (non-P2002) recorded, the rest persist", async () => {
    queueJobs(["job-1"])
    vi.mocked(fetchDatasetItems).mockResolvedValue([{ url: "http://a" }, { url: "http://b" }] as never)
    vi.mocked(prisma.processedSignal.create)
      .mockRejectedValueOnce(new Error("db blip") as never)
      .mockResolvedValueOnce({} as never)

    const res = await runApifyIngestion()
    expect(res).toMatchObject({ inserted: 1, errors: 1, duplicates: 0 })
  })

  it("[5] cap respected — only `cap` jobs claimed/processed per run", async () => {
    queueJobs(["j1", "j2", "j3", "j4"])
    const res = await runApifyIngestion({ cap: 2 })
    expect(res.jobs).toBe(2)
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2) // stops at cap, doesn't claim a 3rd
  })

  it("[6] extractSourceUrl — url ?? link ?? stable content hash (deterministic)", () => {
    expect(extractSourceUrl({ url: "http://a" })).toBe("http://a")
    expect(extractSourceUrl({ link: "http://b" })).toBe("http://b")
    const h1 = extractSourceUrl({ title: "x", n: 1 })
    expect(h1).toMatch(/^sha256:/)
    expect(extractSourceUrl({ title: "x", n: 1 })).toBe(h1) // same item → same key
  })
})
