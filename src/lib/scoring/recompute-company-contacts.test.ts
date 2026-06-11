import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/prisma", () => ({
  prisma: { crmContact: { findMany: vi.fn() } },
}))
vi.mock("@/lib/scoring/persist-score", () => ({ persistScore: vi.fn() }))

import { recomputeCompanyContacts } from "./recompute-company-contacts"
import { prisma } from "@/lib/prisma"
import { persistScore } from "@/lib/scoring/persist-score"
import type { ScoringConfigBlob } from "@/lib/scoring/config-types"

const CONFIG = { schemaVersion: 2 } as unknown as ScoringConfigBlob
const NOW = new Date("2026-06-10T00:00:00.000Z")

describe("recomputeCompanyContacts", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.crmContact.findMany).mockResolvedValue([] as never)
    vi.mocked(persistScore).mockResolvedValue({} as never)
  })

  it("loops persistScore over every scoring-eligible contact of the company", async () => {
    vi.mocked(prisma.crmContact.findMany).mockResolvedValue([
      { id: "ct-1" },
      { id: "ct-2" },
      { id: "ct-3" },
    ] as never)

    const res = await recomputeCompanyContacts("co-1", CONFIG, 2, NOW)

    expect(res).toEqual({ contacts: 3, recomputed: 3, errors: 0 })
    expect(persistScore).toHaveBeenCalledTimes(3)
    expect(persistScore).toHaveBeenNthCalledWith(1, "ct-1", "contact", CONFIG, 2, NOW)
    expect(persistScore).toHaveBeenNthCalledWith(3, "ct-3", "contact", CONFIG, 2, NOW)
  })

  it("mirrors the runner's scoring-exclusion filter (NOT excludedFrom has scoring)", async () => {
    await recomputeCompanyContacts("co-1", CONFIG, 2, NOW)
    const arg = vi.mocked(prisma.crmContact.findMany).mock.calls[0][0] as {
      where: { companyId: string; NOT: { excludedFrom: { has: string } } }
    }
    expect(arg.where.companyId).toBe("co-1")
    expect(arg.where.NOT.excludedFrom.has).toBe("scoring")
  })

  it("isolates a per-contact failure — the rest still recompute", async () => {
    vi.mocked(prisma.crmContact.findMany).mockResolvedValue([
      { id: "ct-1" },
      { id: "ct-bad" },
      { id: "ct-3" },
    ] as never)
    vi.mocked(persistScore)
      .mockResolvedValueOnce({} as never)
      .mockRejectedValueOnce(new Error("score boom") as never)
      .mockResolvedValueOnce({} as never)

    const res = await recomputeCompanyContacts("co-1", CONFIG, 2, NOW)
    expect(res).toEqual({ contacts: 3, recomputed: 2, errors: 1 })
  })

  it("no eligible contacts → no persistScore calls", async () => {
    const res = await recomputeCompanyContacts("co-empty", CONFIG, 2, NOW)
    expect(res).toEqual({ contacts: 0, recomputed: 0, errors: 0 })
    expect(persistScore).not.toHaveBeenCalled()
  })
})
