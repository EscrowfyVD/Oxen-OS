// Tests for server-only helpers in clay-enrichment.ts.
//
// Pure helpers (classifyPersona, extractClayTableSegment, parseClayTableName)
// were extracted to @/lib/clay-helpers in Sprint S0 batch 4 hotfix —
// their tests live in clay-helpers.test.ts.
//
// This file covers:
//   - assignRandomBD (depends on prisma + env var)
//   - upsertPersonFromClay acquisitionSource handling (Hotfix R0,
//     2026-05-15 — narrow unit coverage to lock in the contact-level
//     provenance contract; broader pipeline assertions live in
//     route.test.ts at /api/webhooks/clay-enrichment and
//     /api/crm/contacts/import-clay).

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// Mock Prisma BEFORE importing the module under test so the singleton
// import inside clay-enrichment resolves to our mock.
vi.mock("@/lib/prisma", () => ({
  prisma: {
    employee: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
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
  },
}))

import { assignRandomBD, upsertPersonFromClay } from "./clay-enrichment"
import { prisma } from "@/lib/prisma"
import type { ClayEnrichmentPayload } from "@/app/api/webhooks/_schemas"

describe("assignRandomBD", () => {
  const ORIGINAL_ENV = process.env.CRM_BD_EMAILS

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    if (ORIGINAL_ENV === undefined) {
      delete process.env.CRM_BD_EMAILS
    } else {
      process.env.CRM_BD_EMAILS = ORIGINAL_ENV
    }
  })

  it("returns one of the matched BD IDs (50/50 with 2 BDs)", async () => {
    process.env.CRM_BD_EMAILS = "andy@oxen.finance,paullouis@oxen.finance"
    vi.mocked(prisma.employee.findMany).mockResolvedValue([
      { id: "andy-id" },
      { id: "paul-id" },
    ] as never)

    const id = await assignRandomBD()
    expect(["andy-id", "paul-id"]).toContain(id)
    expect(prisma.employee.findMany).toHaveBeenCalledWith({
      where: {
        email: {
          in: ["andy@oxen.finance", "paullouis@oxen.finance"],
          mode: "insensitive",
        },
        isActive: true,
      },
      select: { id: true },
    })
  })

  it("returns null when no BD found in DB", async () => {
    process.env.CRM_BD_EMAILS = "andy@oxen.finance,paullouis@oxen.finance"
    vi.mocked(prisma.employee.findMany).mockResolvedValue([] as never)

    const id = await assignRandomBD()
    expect(id).toBeNull()
  })

  it("returns null when CRM_BD_EMAILS env var is unset", async () => {
    delete process.env.CRM_BD_EMAILS
    const id = await assignRandomBD()
    expect(id).toBeNull()
    // Should NOT call Prisma when no emails to match
    expect(prisma.employee.findMany).not.toHaveBeenCalled()
  })
})

// ─────────────────────────────────────────────────────────────────────
// Hotfix R0 (2026-05-15) — acquisitionSource on Clay upsert
// ─────────────────────────────────────────────────────────────────────
//
// Regression coverage for the silent NULL bug that left 597 legacy
// CrmContacts without a provenance label. The fix writes
// "Clay / Outbound Sequence" on CREATE and only backfills on UPDATE
// when the existing value is null (preserves "Conference" / "Referral"
// from contacts touched by another pipeline first).

const PEOPLE_PAYLOAD_BASE: ClayEnrichmentPayload = {
  source_table: "vDC_G1_Tier 1_People_Active Business Loss",
  scope: "people",
  group: "G1",
  pain_tier: "T1",
  person: {
    firstName: "Jean-Philippe",
    lastName: "Chetcuti",
    email: "jpc@inter-serv.com",
    jobTitle: "CEO",
    // No `company` sub-payload to keep the test focused on the
    // CrmContact upsert path — Company-side behavior is exercised
    // by the route-level tests.
  },
}

describe("upsertPersonFromClay — acquisitionSource (R0 fix)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // No BD pool wired up — the helper's randomBD step just returns null.
    delete process.env.CRM_BD_EMAILS
  })

  it("sets acquisitionSource='Clay / Outbound Sequence' on CREATE", async () => {
    vi.mocked(prisma.crmContact.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.crmContact.create).mockResolvedValue({ id: "ct-new" } as never)

    const res = await upsertPersonFromClay(PEOPLE_PAYLOAD_BASE)
    expect(res.ok).toBe(true)

    const createArg = vi.mocked(prisma.crmContact.create).mock.calls[0][0]
    expect(createArg.data.acquisitionSource).toBe("Clay / Outbound Sequence")
  })

  it("backfills acquisitionSource on UPDATE when existing is null", async () => {
    vi.mocked(prisma.crmContact.findFirst).mockResolvedValue({
      id: "ct-legacy",
      dealOwner: "Andy",
      acquisitionSource: null,
    } as never)
    vi.mocked(prisma.crmContact.update).mockResolvedValue({} as never)

    const res = await upsertPersonFromClay(PEOPLE_PAYLOAD_BASE)
    expect(res.ok).toBe(true)

    const updateArg = vi.mocked(prisma.crmContact.update).mock.calls[0][0]
    expect(updateArg.data.acquisitionSource).toBe("Clay / Outbound Sequence")
  })

  it("PRESERVES existing acquisitionSource on UPDATE (no override on re-enrichment)", async () => {
    // Contact previously created via the Conference pipeline — Clay
    // re-enrichment must NOT downgrade the provenance to "Clay /…".
    vi.mocked(prisma.crmContact.findFirst).mockResolvedValue({
      id: "ct-conf",
      dealOwner: "Paul Louis",
      acquisitionSource: "Conference",
    } as never)
    vi.mocked(prisma.crmContact.update).mockResolvedValue({} as never)

    const res = await upsertPersonFromClay(PEOPLE_PAYLOAD_BASE)
    expect(res.ok).toBe(true)

    const updateArg = vi.mocked(prisma.crmContact.update).mock.calls[0][0]
    // The update payload must NOT include acquisitionSource at all —
    // omitting the key is how we tell Prisma "leave this column alone".
    expect(updateArg.data).not.toHaveProperty("acquisitionSource")
  })
})
