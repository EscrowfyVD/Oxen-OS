// Tests for server-only helpers in clay-enrichment.ts.
//
// Pure helpers (classifyPersona, extractClayTableSegment, parseClayTableName)
// were extracted to @/lib/clay-helpers in Sprint S0 batch 4 hotfix —
// their tests live in clay-helpers.test.ts.
//
// This file covers only assignRandomBD (depends on prisma + env var).
// upsertCompanyFromClay / upsertPersonFromClay are exercised in their
// integration tests at the route level
// (src/app/api/webhooks/clay-enrichment/route.test.ts and
//  src/app/api/crm/contacts/import-clay/route.test.ts).

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// Mock Prisma BEFORE importing the module under test so the singleton
// import inside clay-enrichment resolves to our mock.
vi.mock("@/lib/prisma", () => ({
  prisma: {
    employee: {
      findMany: vi.fn(),
    },
  },
}))

import { assignRandomBD } from "./clay-enrichment"
import { prisma } from "@/lib/prisma"

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
