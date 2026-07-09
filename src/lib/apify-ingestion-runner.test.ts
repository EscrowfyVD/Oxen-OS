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
    processedSignal: { create: vi.fn(), update: vi.fn() },
  },
}))
vi.mock("@/lib/apify", () => ({ fetchDatasetItems: vi.fn() }))
// PR3b routing deps — mocked. The keyword matcher stays REAL (pure), so test
// items must carry a genuine industry keyword in title/description to pass.
vi.mock("@/lib/signal-ingestion", () => ({ ingestSignal: vi.fn() }))
vi.mock("@/lib/apify-account-match", () => ({
  matchCompanyByName: vi.fn(),
  matchOrCreateCompanyByName: vi.fn(),
  MATCH_THRESHOLD: 0.85, // the runner imports the shared threshold from here
}))
vi.mock("@/lib/scoring/recompute-company-contacts", () => ({
  recomputeCompanyContacts: vi.fn(),
}))
vi.mock("@/lib/scoring/config-loader", () => ({
  getActiveScoringConfigWithVersion: vi.fn(),
}))
// PR3c-a invariant: NO Apollo anywhere on the capture path. The runner does
// not even import @/lib/apollo — this mock + the not-called asserts guard a
// future accidental wiring.
vi.mock("@/lib/apollo", () => ({
  enrichPerson: vi.fn(),
  enrichOrganization: vi.fn(),
  isApolloConfigured: vi.fn(),
}))

import { runApifyIngestion, extractSourceUrl } from "./apify-ingestion-runner"
import { prisma } from "@/lib/prisma"
import { fetchDatasetItems } from "@/lib/apify"
import { ingestSignal } from "@/lib/signal-ingestion"
import { matchCompanyByName, matchOrCreateCompanyByName } from "@/lib/apify-account-match"
import { recomputeCompanyContacts } from "@/lib/scoring/recompute-company-contacts"
import { getActiveScoringConfigWithVersion } from "@/lib/scoring/config-loader"
import { enrichPerson, enrichOrganization } from "@/lib/apollo"

// A routable Job (crunchbase-f) + a "good" fresh, keyword-bearing, named item.
const CB_CATEGORY = "crunchbase-f"
function routableJob(category: string) {
  return { id: "job-1", payload: { datasetId: "ds_1", category, actId: "act-x" }, attempts: 1, maxAttempts: 3 }
}
function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

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
    vi.mocked(prisma.processedSignal.create).mockResolvedValue({ id: "ps-1" } as never)
    vi.mocked(prisma.processedSignal.update).mockResolvedValue({} as never)
    vi.mocked(fetchDatasetItems).mockResolvedValue([] as never)
    // PR3b routing defaults (a clean match path; tests override per-case):
    vi.mocked(matchCompanyByName).mockResolvedValue({ companyId: "co-1", name: "Acme", confidence: 0.95 } as never)
    vi.mocked(ingestSignal).mockResolvedValue({ ok: true, scope: "company", signal: {} } as never)
    vi.mocked(recomputeCompanyContacts).mockResolvedValue({ contacts: 2, recomputed: 2, errors: 0 } as never)
    vi.mocked(getActiveScoringConfigWithVersion).mockResolvedValue({ config: {}, version: 2 } as never)
    // PR3c-a capture default (only reached on a sub-0.85 match):
    vi.mocked(matchOrCreateCompanyByName).mockResolvedValue({ companyId: "co-new", created: true, confidence: null } as never)
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

  // ─── PR3b routing gate ────────────────────────────────────────────

  it("[7] non-allowlisted actor (reddit-c) → stored but NEVER routed", async () => {
    queueJobs(["job-1"]) // default JOB category is reddit-c (not routable)
    vi.mocked(fetchDatasetItems).mockResolvedValue([
      { name: "Acme Capital", url: "http://x/a", description: "fintech treasury", lastFundingDate: isoDaysAgo(0) },
    ] as never)

    const res = await runApifyIngestion()
    expect(prisma.processedSignal.create).toHaveBeenCalledTimes(1) // stored
    expect(matchCompanyByName).not.toHaveBeenCalled()
    expect(ingestSignal).not.toHaveBeenCalled()
    expect(prisma.processedSignal.update).not.toHaveBeenCalled()
    expect(res).toMatchObject({ routed: 0, unmatched: 0 })
  })

  it("[8] crunchbase match → ingestSignal company-scope (apify_f) + accountId set + recompute looped", async () => {
    queueJobs(["job-1"])
    vi.mocked(prisma.job.findUnique).mockResolvedValue(routableJob(CB_CATEGORY) as never)
    const funded = isoDaysAgo(1)
    vi.mocked(fetchDatasetItems).mockResolvedValue([
      { name: "Acme Capital", url: "http://cb/acme", description: "a fintech treasury startup", lastFundingDate: funded },
    ] as never)
    vi.mocked(prisma.processedSignal.create).mockResolvedValue({ id: "ps-9" } as never)

    const res = await runApifyIngestion()

    expect(matchCompanyByName).toHaveBeenCalledWith("Acme Capital")
    expect(ingestSignal).toHaveBeenCalledTimes(1)
    const payload = vi.mocked(ingestSignal).mock.calls[0][0] as {
      scope: string
      companyId: string
      signalTypeCode: string
      sourceUrl?: string
      occurredAt?: string
    }
    expect(payload).toMatchObject({
      scope: "company",
      companyId: "co-1",
      signalTypeCode: "apify_f",
      sourceUrl: "http://cb/acme",
    })
    expect(payload.occurredAt).toBe(funded)
    expect(prisma.processedSignal.update).toHaveBeenCalledWith({
      where: { id: "ps-9" },
      data: { accountId: "co-1" },
    })
    expect(recomputeCompanyContacts).toHaveBeenCalledTimes(1)
    expect(vi.mocked(recomputeCompanyContacts).mock.calls[0][0]).toBe("co-1")
    // PR3c-a: the matched path is UNCHANGED — no capture, no create.
    expect(matchOrCreateCompanyByName).not.toHaveBeenCalled()
    expect(res).toMatchObject({ routed: 1, created: 0, unmatched: 0 })
  })

  it("[9] keyword miss → no route (stored only; matcher + ingest untouched)", async () => {
    queueJobs(["job-1"])
    vi.mocked(prisma.job.findUnique).mockResolvedValue(routableJob(CB_CATEGORY) as never)
    vi.mocked(fetchDatasetItems).mockResolvedValue([
      { name: "Sunshine Bakery", url: "http://cb/bake", description: "artisan sourdough", lastFundingDate: isoDaysAgo(0) },
    ] as never)

    const res = await runApifyIngestion()
    expect(prisma.processedSignal.create).toHaveBeenCalledTimes(1)
    expect(matchCompanyByName).not.toHaveBeenCalled()
    expect(matchOrCreateCompanyByName).not.toHaveBeenCalled() // gate-dropped → NEVER creates
    expect(ingestSignal).not.toHaveBeenCalled()
    expect(res).toMatchObject({ routed: 0, created: 0, unmatched: 0 })
  })

  it("[10] stale item (>7d) → no route", async () => {
    queueJobs(["job-1"])
    vi.mocked(prisma.job.findUnique).mockResolvedValue(routableJob(CB_CATEGORY) as never)
    vi.mocked(fetchDatasetItems).mockResolvedValue([
      { name: "Acme Capital", url: "http://cb/acme", description: "fintech treasury", lastFundingDate: isoDaysAgo(10) },
    ] as never)

    const res = await runApifyIngestion()
    expect(matchCompanyByName).not.toHaveBeenCalled()
    expect(matchOrCreateCompanyByName).not.toHaveBeenCalled() // gate-dropped → NEVER creates
    expect(ingestSignal).not.toHaveBeenCalled()
    expect(res).toMatchObject({ routed: 0, created: 0 })
  })

  it("[11] null company field → no route (jobboard item missing `company`)", async () => {
    queueJobs(["job-1"])
    vi.mocked(prisma.job.findUnique).mockResolvedValue(routableJob("jobboard-g") as never)
    vi.mocked(fetchDatasetItems).mockResolvedValue([
      { title: "Head of KYC", url: "http://jb/1", description: "compliance role", date_posted: isoDaysAgo(0) },
    ] as never)

    const res = await runApifyIngestion()
    expect(matchCompanyByName).not.toHaveBeenCalled()
    expect(matchOrCreateCompanyByName).not.toHaveBeenCalled() // gate-dropped → NEVER creates
    expect(ingestSignal).not.toHaveBeenCalled()
    expect(res).toMatchObject({ routed: 0, created: 0 })
  })

  it("[12] PR3c-a: real no-match (<0.85) → company CAPTURED + signal attached + accountId set + zero-contact recompute + NO Apollo", async () => {
    queueJobs(["job-1"])
    vi.mocked(prisma.job.findUnique).mockResolvedValue(routableJob("jobboard-g") as never)
    const posted = isoDaysAgo(0)
    vi.mocked(fetchDatasetItems).mockResolvedValue([
      {
        company: "payabl.",
        title: "Head of Compliance",
        url: "http://jb/2",
        date_posted: posted,
        company_url: "https://uk.linkedin.com/company/payabl-eu",
        location: "Limassol, Cyprus",
      },
    ] as never)
    vi.mocked(matchCompanyByName).mockResolvedValue({ companyId: "co-x", name: "Paya", confidence: 0.7 } as never)
    vi.mocked(prisma.processedSignal.create).mockResolvedValue({ id: "ps-cap" } as never)
    // brand-new company → zero-contact recompute is a clean no-op (no error)
    vi.mocked(recomputeCompanyContacts).mockResolvedValue({ contacts: 0, recomputed: 0, errors: 0 } as never)

    const res = await runApifyIngestion()

    // capture called with the payload create-fields (linkedinUrl + location)
    expect(matchOrCreateCompanyByName).toHaveBeenCalledWith("payabl.", {
      linkedinUrl: "https://uk.linkedin.com/company/payabl-eu",
      location: "Limassol, Cyprus",
    })
    // signal attached to the CREATED account
    const payload = vi.mocked(ingestSignal).mock.calls[0][0] as {
      scope: string
      companyId: string
      signalTypeCode: string
      occurredAt?: string
    }
    expect(payload).toMatchObject({ scope: "company", companyId: "co-new", signalTypeCode: "apify_g" })
    expect(payload.occurredAt).toBe(posted)
    expect(prisma.processedSignal.update).toHaveBeenCalledWith({
      where: { id: "ps-cap" },
      data: { accountId: "co-new" },
    })
    // targeted recompute ran on the new company and no-op'd cleanly
    expect(recomputeCompanyContacts).toHaveBeenCalledTimes(1)
    expect(vi.mocked(recomputeCompanyContacts).mock.calls[0][0]).toBe("co-new")
    // NO Apollo call anywhere on the capture path (PR3c-a invariant)
    expect(enrichPerson).not.toHaveBeenCalled()
    expect(enrichOrganization).not.toHaveBeenCalled()
    expect(res).toMatchObject({ routed: 1, created: 1, unmatched: 0, errors: 0 })
  })

  it("[13] jobboard match → ingestSignal code apify_g + accountId set", async () => {
    queueJobs(["job-1"])
    vi.mocked(prisma.job.findUnique).mockResolvedValue(routableJob("jobboard-g") as never)
    vi.mocked(fetchDatasetItems).mockResolvedValue([
      { company: "Acme Capital", title: "Head of KYC", url: "http://jb/3", date_posted: isoDaysAgo(0) },
    ] as never)
    vi.mocked(prisma.processedSignal.create).mockResolvedValue({ id: "ps-jb" } as never)

    const res = await runApifyIngestion()
    const payload = vi.mocked(ingestSignal).mock.calls[0][0] as { signalTypeCode: string; companyId: string }
    expect(payload.signalTypeCode).toBe("apify_g")
    expect(payload.companyId).toBe("co-1")
    expect(prisma.processedSignal.update).toHaveBeenCalledWith({
      where: { id: "ps-jb" },
      data: { accountId: "co-1" },
    })
    expect(res).toMatchObject({ routed: 1 })
  })

  it("[14] duplicate item (P2002) → stored-skip, NEVER re-routed", async () => {
    queueJobs(["job-1"])
    vi.mocked(prisma.job.findUnique).mockResolvedValue(routableJob(CB_CATEGORY) as never)
    vi.mocked(fetchDatasetItems).mockResolvedValue([
      { name: "Acme Capital", url: "http://cb/acme", description: "fintech treasury", lastFundingDate: isoDaysAgo(0) },
    ] as never)
    const p2002 = new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "5.22.0" })
    vi.mocked(prisma.processedSignal.create).mockRejectedValue(p2002 as never)

    const res = await runApifyIngestion()
    expect(matchCompanyByName).not.toHaveBeenCalled() // created === null → routing skipped
    expect(ingestSignal).not.toHaveBeenCalled()
    expect(res).toMatchObject({ duplicates: 1, routed: 0 })
  })

  it("[15] ingestSignal rejected (e.g. prod seed not run) → error, accountId null, no recompute", async () => {
    queueJobs(["job-1"])
    vi.mocked(prisma.job.findUnique).mockResolvedValue(routableJob(CB_CATEGORY) as never)
    vi.mocked(fetchDatasetItems).mockResolvedValue([
      { name: "Acme Capital", url: "http://cb/acme", description: "fintech treasury", lastFundingDate: isoDaysAgo(0) },
    ] as never)
    vi.mocked(ingestSignal).mockResolvedValue({ ok: false, status: 400, code: "UNKNOWN_SIGNAL_TYPE", error: "x" } as never)

    const res = await runApifyIngestion()
    expect(ingestSignal).toHaveBeenCalledTimes(1)
    expect(prisma.processedSignal.update).not.toHaveBeenCalled()
    expect(recomputeCompanyContacts).not.toHaveBeenCalled()
    expect(res).toMatchObject({ routed: 0, errors: 1 })
  })

  it("[16] PR3c-a: capture fuzzy-attaches to an existing account → routed, NOT duplicated (created 0)", async () => {
    queueJobs(["job-1"])
    vi.mocked(prisma.job.findUnique).mockResolvedValue(routableJob("jobboard-g") as never)
    vi.mocked(fetchDatasetItems).mockResolvedValue([
      { company: "Wirex", title: "Compliance & AML Officer", url: "http://jb/9", date_posted: isoDaysAgo(0) },
    ] as never)
    vi.mocked(matchCompanyByName).mockResolvedValue(null as never) // routing saw nothing…
    // …but the capture's fuzzy guard found "Wirex Limited" (race / suffix case)
    vi.mocked(matchOrCreateCompanyByName).mockResolvedValue({ companyId: "co-wirex", created: false, confidence: 1.0 } as never)
    vi.mocked(prisma.processedSignal.create).mockResolvedValue({ id: "ps-w" } as never)

    const res = await runApifyIngestion()
    const payload = vi.mocked(ingestSignal).mock.calls[0][0] as { companyId: string }
    expect(payload.companyId).toBe("co-wirex")
    expect(prisma.processedSignal.update).toHaveBeenCalledWith({
      where: { id: "ps-w" },
      data: { accountId: "co-wirex" },
    })
    expect(res).toMatchObject({ routed: 1, created: 0, unmatched: 0 })
  })

  it("[17] PR3c-a: unmatchable name (capture → null) → no signal, accountId stays null, unmatched++", async () => {
    queueJobs(["job-1"])
    vi.mocked(prisma.job.findUnique).mockResolvedValue(routableJob("jobboard-g") as never)
    vi.mocked(fetchDatasetItems).mockResolvedValue([
      { company: "Ltd", title: "Head of Compliance", url: "http://jb/10", date_posted: isoDaysAgo(0) },
    ] as never)
    vi.mocked(matchCompanyByName).mockResolvedValue(null as never)
    vi.mocked(matchOrCreateCompanyByName).mockResolvedValue(null as never)

    const res = await runApifyIngestion()
    expect(ingestSignal).not.toHaveBeenCalled()
    expect(prisma.processedSignal.update).not.toHaveBeenCalled()
    expect(recomputeCompanyContacts).not.toHaveBeenCalled()
    expect(res).toMatchObject({ routed: 0, created: 0, unmatched: 1 })
  })
})
