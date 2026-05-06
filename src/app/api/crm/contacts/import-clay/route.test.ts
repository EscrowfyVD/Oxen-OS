/**
 * Integration tests for /api/crm/contacts/import-clay (Sprint S0 batch 4).
 *
 * Verifies batch processing: chunking, Promise.allSettled isolation,
 * aggregated counters, single source of truth (calls same upsert
 * helpers as the webhook).
 */

import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest"

// Mock prisma + admin so requirePageAccess returns success
vi.mock("@/lib/prisma", () => ({
  prisma: {
    company: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    crmContact: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    employee: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
  },
}))

vi.mock("@/lib/admin", () => ({
  requirePageAccess: vi.fn(),
}))

import { POST } from "./route"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"

function makeReq(body: unknown) {
  return new Request("http://localhost/api/crm/contacts/import-clay", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

const COMPANY_ROW_VALID = {
  name: "MidChains",
  domain: "midchains.com",
  primaryIndustry: "Financial Services",
  size: "11-50 employees",
  type: "Privately Held",
  country: "United Arab Emirates",
}

const COMPANY_BATCH_VALID = {
  source_table: "vDC_G1_Tier 1_Company_Active Business Loss",
  scope: "company",
  group: "G1",
  pain_tier: "T1",
  rows: [COMPANY_ROW_VALID],
}

describe("POST /api/crm/contacts/import-clay", () => {
  beforeAll(() => {
    process.env.CRM_BD_EMAILS =
      "andy@oxen.finance,paullouis@oxen.finance"
  })

  beforeEach(() => {
    vi.clearAllMocks()
    // Default: requirePageAccess returns success (no error)
    vi.mocked(requirePageAccess).mockResolvedValue({
      error: null,
      session: { user: { email: "andy@oxen.finance" } },
      employee: null,
      roleLevel: "admin",
    } as never)
    // Default: no BD found — assignRandomBD returns null
    vi.mocked(prisma.employee.findMany).mockResolvedValue([] as never)
  })

  it("returns 401/403 when requirePageAccess fails", async () => {
    vi.mocked(requirePageAccess).mockResolvedValue({
      error: new Response("Forbidden", { status: 403 }),
    } as never)
    const res = await POST(makeReq(COMPANY_BATCH_VALID))
    expect(res.status).toBe(403)
  })

  it("returns 400 on invalid scope", async () => {
    const res = await POST(
      makeReq({ ...COMPANY_BATCH_VALID, scope: "invalid" }),
    )
    expect(res.status).toBe(400)
  })

  it("returns 400 when rows array is empty", async () => {
    const res = await POST(makeReq({ ...COMPANY_BATCH_VALID, rows: [] }))
    expect(res.status).toBe(400)
  })

  it("imports a single Company row (created)", async () => {
    vi.mocked(prisma.company.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.company.create).mockResolvedValue({
      id: "co-1",
    } as never)

    const res = await POST(makeReq(COMPANY_BATCH_VALID))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toMatchObject({
      success: true,
      total: 1,
      created: 1,
      updated: 0,
      errored: 0,
    })
    expect(prisma.company.create).toHaveBeenCalledTimes(1)
  })

  it("aggregates counters across mixed created/updated rows", async () => {
    const rows = [
      { ...COMPANY_ROW_VALID, domain: "co-new-1.com" },
      { ...COMPANY_ROW_VALID, domain: "co-new-2.com" },
      { ...COMPANY_ROW_VALID, domain: "co-existing.com" },
    ]
    // First 2: findUnique returns null → create
    // 3rd:    findUnique returns existing → update
    vi.mocked(prisma.company.findUnique)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "co-existing" } as never)
    vi.mocked(prisma.company.create).mockResolvedValue({
      id: "co-new",
    } as never)
    vi.mocked(prisma.company.update).mockResolvedValue({
      id: "co-existing",
    } as never)

    const res = await POST(
      makeReq({ ...COMPANY_BATCH_VALID, rows }),
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.total).toBe(3)
    expect(body.created).toBe(2)
    expect(body.updated).toBe(1)
    expect(body.errored).toBe(0)
  })

  it("isolates row failures via Promise.allSettled (other rows succeed)", async () => {
    const rows = [
      { ...COMPANY_ROW_VALID, domain: "ok-1.com" },
      { ...COMPANY_ROW_VALID, domain: "fails.com" },
      { ...COMPANY_ROW_VALID, domain: "ok-2.com" },
    ]
    // Row 0 + 2: success path
    // Row 1: prisma throws on BOTH the initial call AND the retry
    //        (Sprint S0 batch 4 hotfix v2 added retry x1 in processRow,
    //         so we queue 4 mocks: 1st row 0, 2nd row 1 attempt 1,
    //         3rd row 2, 4th row 1 retry).
    vi.mocked(prisma.company.findUnique)
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new Error("DB connection lost"))
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new Error("DB connection lost"))
    vi.mocked(prisma.company.create).mockResolvedValue({
      id: "co-x",
    } as never)

    const res = await POST(
      makeReq({ ...COMPANY_BATCH_VALID, rows }),
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.total).toBe(3)
    expect(body.created).toBe(2)
    expect(body.errored).toBe(1)
    expect(body.errors).toHaveLength(1)
    expect(body.errors[0]).toMatchObject({
      index: 1,
      error: expect.stringContaining("DB connection lost"),
    })
  })

  // ──────────────────────────────────────────────────────────────────
  // Sprint S0 batch 4 hotfix v2 — per-row Zod validation
  // ──────────────────────────────────────────────────────────────────
  it("isolates per-row Zod failures (1 valid + 1 invalid → 1 created, 1 errored)", async () => {
    const rows = [
      { ...COMPANY_ROW_VALID, domain: "valid.com" },
      // Missing required `name` field → fails clayBatchCompanyRowSchema
      { domain: "missing-name.com", country: "France" },
    ]
    // Only the valid row reaches Prisma — invalid one is rejected at
    // the per-row Zod step before any DB call.
    vi.mocked(prisma.company.findUnique).mockResolvedValueOnce(null)
    vi.mocked(prisma.company.create).mockResolvedValue({
      id: "co-valid",
    } as never)

    const res = await POST(
      makeReq({ ...COMPANY_BATCH_VALID, rows }),
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.total).toBe(2)
    expect(body.created).toBe(1)
    expect(body.updated).toBe(0)
    expect(body.errored).toBe(1)
    expect(body.errors).toHaveLength(1)
    expect(body.errors[0]).toMatchObject({
      index: 1,
      error: expect.stringContaining("Validation"),
    })
    // Invalid row must not have triggered any Prisma write
    expect(prisma.company.create).toHaveBeenCalledTimes(1)
  })

  it("accepts a long description (>2000 but <10000 chars) after the bump", async () => {
    // Pre-hotfix, this would fail upfront with 400 Invalid input. The
    // schema bump (max 2000 → max 10000) lifts the limit; per-row
    // validation lets it through to the upsert.
    const longDescription = "A".repeat(8000)
    const rows = [
      { ...COMPANY_ROW_VALID, domain: "long-desc.com", description: longDescription },
    ]
    vi.mocked(prisma.company.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.company.create).mockResolvedValue({
      id: "co-long",
    } as never)

    const res = await POST(
      makeReq({ ...COMPANY_BATCH_VALID, rows }),
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.total).toBe(1)
    expect(body.created).toBe(1)
    expect(body.errored).toBe(0)
    // Verify the long description reached prisma.company.create
    const createArgs = vi.mocked(prisma.company.create).mock.calls[0][0]
    expect((createArgs.data as { description: string }).description).toHaveLength(
      8000,
    )
  })

  it("rejects a description over 10000 chars at per-row validation", async () => {
    const tooLong = "A".repeat(10001)
    const rows = [
      { ...COMPANY_ROW_VALID, domain: "way-too-long.com", description: tooLong },
    ]

    const res = await POST(
      makeReq({ ...COMPANY_BATCH_VALID, rows }),
    )
    const body = await res.json()

    // Batch metadata is fine (200) but the row is errored.
    expect(res.status).toBe(200)
    expect(body.total).toBe(1)
    expect(body.created).toBe(0)
    expect(body.errored).toBe(1)
    expect(body.errors[0]).toMatchObject({
      index: 0,
      error: expect.stringContaining("description"),
    })
    // No DB write attempted for invalid row.
    expect(prisma.company.create).not.toHaveBeenCalled()
  })

  it("processes 250-row batch in 3 chunks (CHUNK_SIZE=100)", async () => {
    const rows = Array.from({ length: 250 }, (_, i) => ({
      ...COMPANY_ROW_VALID,
      domain: `co-${i}.com`,
    }))
    vi.mocked(prisma.company.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.company.create).mockResolvedValue({
      id: "co-bulk",
    } as never)

    const res = await POST(
      makeReq({ ...COMPANY_BATCH_VALID, rows }),
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.total).toBe(250)
    expect(body.created).toBe(250)
    expect(prisma.company.create).toHaveBeenCalledTimes(250)
  })

  it("processes a People batch (uses upsertPersonFromClay)", async () => {
    const personRow = {
      firstName: "Jean",
      lastName: "Dupont",
      email: "jean@example.com",
      jobTitle: "CEO",
      company: { name: "Example", domain: "example.com" },
    }
    const peopleBatch = {
      source_table: "vDC_G1_Tier 1_People_Active Business Loss",
      scope: "people",
      group: "G1",
      pain_tier: "T1",
      rows: [personRow],
    }
    vi.mocked(prisma.company.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.company.create).mockResolvedValue({
      id: "co-p1",
    } as never)
    vi.mocked(prisma.crmContact.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.crmContact.create).mockResolvedValue({
      id: "ct-p1",
    } as never)

    const res = await POST(makeReq(peopleBatch))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.total).toBe(1)
    expect(body.created).toBe(1)
    expect(prisma.crmContact.create).toHaveBeenCalledTimes(1)
    const args = vi.mocked(prisma.crmContact.create).mock.calls[0][0]
    expect(args.data.persona).toBe("DM") // CEO → DM
  })
})
