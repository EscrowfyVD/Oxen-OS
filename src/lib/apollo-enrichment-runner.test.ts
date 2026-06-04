/**
 * Tests for runApolloEnrichment (PR-Z). Mocks the Apollo client, the mappers,
 * and prisma. Asserts: contact hit → mapped; null → enrichedAt untouched
 * (left for retry); error isolation; cap respected; idempotence (enrichedAt
 * IS NULL filter); no-key path no-ops cleanly (client returns null).
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    crmContact: { findMany: vi.fn() },
    company: { findMany: vi.fn() },
  },
}))
vi.mock("@/lib/apollo", () => ({
  enrichPerson: vi.fn(),
  enrichOrganization: vi.fn(),
}))
vi.mock("./apollo-enrichment", () => ({
  upsertPersonFromApollo: vi.fn(),
  upsertCompanyFromApollo: vi.fn(),
}))

import { runApolloEnrichment } from "./apollo-enrichment-runner"
import { prisma } from "@/lib/prisma"
import { enrichPerson, enrichOrganization } from "@/lib/apollo"
import { upsertPersonFromApollo, upsertCompanyFromApollo } from "./apollo-enrichment"

describe("runApolloEnrichment", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.crmContact.findMany).mockResolvedValue([] as never)
    vi.mocked(prisma.company.findMany).mockResolvedValue([] as never)
    vi.mocked(upsertPersonFromApollo).mockResolvedValue({ ok: true, action: "updated", contactId: "x" } as never)
    vi.mocked(upsertCompanyFromApollo).mockResolvedValue({ ok: true, action: "updated", companyId: "x" } as never)
  })

  it("[1] contact hit → upsertPersonFromApollo called with contactId; enriched++", async () => {
    vi.mocked(prisma.crmContact.findMany).mockResolvedValue([{ id: "ct-1", email: "a@b.com" }] as never)
    vi.mocked(enrichPerson).mockResolvedValue({ id: "p1", title: "CFO" } as never)

    const res = await runApolloEnrichment()
    expect(enrichPerson).toHaveBeenCalledWith({ email: "a@b.com" })
    expect(upsertPersonFromApollo).toHaveBeenCalledWith({ id: "p1", title: "CFO" }, { contactId: "ct-1" })
    expect(res).toMatchObject({ processed: 1, enriched: 1, skipped: 0, errors: [] })
  })

  it("[2] contact no-match (null) → mapper NOT called, enrichedAt left NULL (skipped)", async () => {
    vi.mocked(prisma.crmContact.findMany).mockResolvedValue([{ id: "ct-1", email: "a@b.com" }] as never)
    vi.mocked(enrichPerson).mockResolvedValue(null as never)

    const res = await runApolloEnrichment()
    expect(upsertPersonFromApollo).not.toHaveBeenCalled()
    expect(res).toMatchObject({ processed: 1, enriched: 0, skipped: 1 })
  })

  it("[3] error isolation — one contact throws, the rest still process", async () => {
    vi.mocked(prisma.crmContact.findMany).mockResolvedValue([
      { id: "ct-bad", email: "bad@x.com" },
      { id: "ct-ok", email: "ok@x.com" },
    ] as never)
    vi.mocked(enrichPerson).mockResolvedValue({ id: "p" } as never)
    vi.mocked(upsertPersonFromApollo)
      .mockRejectedValueOnce(new Error("db boom"))
      .mockResolvedValueOnce({ ok: true, action: "updated", contactId: "ct-ok" } as never)

    const res = await runApolloEnrichment()
    expect(res.processed).toBe(2)
    expect(res.enriched).toBe(1)
    expect(res.errors).toEqual([{ kind: "contact", id: "ct-bad", error: "db boom" }])
  })

  it("[4] cap respected — findMany take = cap (both passes)", async () => {
    await runApolloEnrichment({ cap: 7 })
    expect(vi.mocked(prisma.crmContact.findMany).mock.calls[0][0]).toMatchObject({ take: 7 })
    expect(vi.mocked(prisma.company.findMany).mock.calls[0][0]).toMatchObject({ take: 7 })
  })

  it("[5] idempotence — both passes filter enrichedAt IS NULL", async () => {
    await runApolloEnrichment()
    const contactArgs = vi.mocked(prisma.crmContact.findMany).mock.calls[0][0] as {
      where: { enrichedAt: Date | null }
    }
    const companyArgs = vi.mocked(prisma.company.findMany).mock.calls[0][0] as {
      where: { enrichedAt: Date | null; contacts?: unknown }
    }
    expect(contactArgs.where.enrichedAt).toBeNull()
    expect(companyArgs.where.enrichedAt).toBeNull()
    // credit guard: pass 2 is TRULY contact-less only → a company with any
    // contact is enriched free via the contact, never paid via org/enrich
    expect(companyArgs.where.contacts).toEqual({ none: {} })
  })

  it("[6] no-key / all-null → runner no-ops cleanly (client skips, nothing enriched)", async () => {
    vi.mocked(prisma.crmContact.findMany).mockResolvedValue([{ id: "ct-1", email: "a@b.com" }] as never)
    vi.mocked(prisma.company.findMany).mockResolvedValue([{ id: "co-1", domain: "acme.com" }] as never)
    vi.mocked(enrichPerson).mockResolvedValue(null as never) // client returns null without a key
    vi.mocked(enrichOrganization).mockResolvedValue(null as never)

    const res = await runApolloEnrichment()
    expect(upsertPersonFromApollo).not.toHaveBeenCalled()
    expect(upsertCompanyFromApollo).not.toHaveBeenCalled()
    expect(res).toMatchObject({ processed: 2, enriched: 0, skipped: 2, errors: [] })
  })

  it("[7] secondary pass — company hit → upsertCompanyFromApollo with companyId", async () => {
    vi.mocked(prisma.company.findMany).mockResolvedValue([{ id: "co-1", domain: "acme.com" }] as never)
    vi.mocked(enrichOrganization).mockResolvedValue({ id: "o1", name: "Acme" } as never)

    const res = await runApolloEnrichment()
    expect(enrichOrganization).toHaveBeenCalledWith({ domain: "acme.com" })
    expect(upsertCompanyFromApollo).toHaveBeenCalledWith({ id: "o1", name: "Acme" }, { companyId: "co-1" })
    expect(res).toMatchObject({ enriched: 1 })
  })
})
