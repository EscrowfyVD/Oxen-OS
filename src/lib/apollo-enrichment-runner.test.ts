/**
 * Tests for the Apollo enrichment runner.
 *
 * runApolloEnrichment (PR-Z) — passes 1+2: contact hit → mapped; null →
 * enrichedAt untouched; error isolation; cap; idempotence; no-key no-op.
 *
 * runEnrichmentSweep (Apify PR3c-b slice 4) — pass 3: Gate-1 predicate + ordering;
 * distinctSignals gate; monthly cap (successes only); DRY-RUN zero-spend/zero-write;
 * LIVE full chain + credits + recompute; failure marker (attempts++, not enrichedAt);
 * domain-collision dedup; empty-set no-op both modes.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    crmContact: { findMany: vi.fn() },
    company: { findMany: vi.fn(), count: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
    intentSignal: { count: vi.fn() },
  },
}))
vi.mock("@/lib/apollo", () => ({
  enrichPerson: vi.fn(),
  enrichOrganization: vi.fn(),
  searchOrganizations: vi.fn(),
  searchPeople: vi.fn(),
}))
vi.mock("./apollo-enrichment", () => ({
  upsertPersonFromApollo: vi.fn(),
  upsertCompanyFromApollo: vi.fn(),
}))
vi.mock("@/lib/scoring/config-loader", () => ({ getActiveScoringConfigWithVersion: vi.fn() }))
vi.mock("@/lib/scoring/recompute-company-contacts", () => ({ recomputeCompanyContacts: vi.fn() }))

import { runApolloEnrichment, runEnrichmentSweep } from "./apollo-enrichment-runner"
import { prisma } from "@/lib/prisma"
import { enrichPerson, enrichOrganization, searchOrganizations, searchPeople } from "@/lib/apollo"
import { upsertPersonFromApollo, upsertCompanyFromApollo } from "./apollo-enrichment"
import { getActiveScoringConfigWithVersion } from "@/lib/scoring/config-loader"
import { recomputeCompanyContacts } from "@/lib/scoring/recompute-company-contacts"
import type { ScoringConfigBlob } from "@/lib/scoring/config-types"

// Minimal config carrying only the enrichment block the sweep reads (the rest is
// mocked away via recomputeCompanyContacts).
const ENRICH = {
  gate1Threshold: 10,
  gate1MinSignals: 2,
  baseEnrichmentCap: 300,
  phoneRevealCap: 100,
  titles: { decisionMaker: ["Chief Compliance Officer"], operational: ["AML Analyst"] },
}
const cfg = (over: Record<string, unknown> = {}): ScoringConfigBlob =>
  ({ enrichment: { ...ENRICH, ...over } }) as unknown as ScoringConfigBlob

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(prisma.crmContact.findMany).mockResolvedValue([] as never)
  vi.mocked(prisma.company.findMany).mockResolvedValue([] as never)
  vi.mocked(prisma.company.count).mockResolvedValue(0 as never)
  vi.mocked(prisma.company.update).mockResolvedValue({} as never)
  vi.mocked(prisma.company.findUnique).mockResolvedValue(null as never)
  vi.mocked(prisma.intentSignal.count).mockResolvedValue(0 as never)
  vi.mocked(upsertPersonFromApollo).mockResolvedValue({ ok: true, action: "updated", contactId: "x" } as never)
  vi.mocked(upsertCompanyFromApollo).mockResolvedValue({ ok: true, action: "updated", companyId: "x" } as never)
  vi.mocked(getActiveScoringConfigWithVersion).mockResolvedValue({ config: cfg({ dryRun: true }), version: 3 } as never)
  vi.mocked(recomputeCompanyContacts).mockResolvedValue({ contacts: 0, recomputed: 0, errors: 0 } as never)
})

describe("runApolloEnrichment (passes 1+2)", () => {
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
    expect(companyArgs.where.contacts).toEqual({ none: {} })
  })

  it("[6] no-key / all-null → runner no-ops cleanly (client skips, nothing enriched)", async () => {
    vi.mocked(prisma.crmContact.findMany).mockResolvedValue([{ id: "ct-1", email: "a@b.com" }] as never)
    vi.mocked(prisma.company.findMany).mockResolvedValue([{ id: "co-1", domain: "acme.com" }] as never)
    vi.mocked(enrichPerson).mockResolvedValue(null as never)
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

  it("[8] pass 3 wired — runApolloEnrichment loads config + runs the sweep (dry-run no-op)", async () => {
    const res = await runApolloEnrichment()
    expect(getActiveScoringConfigWithVersion).toHaveBeenCalled()
    expect(res.sweep).toMatchObject({ dryRun: true, candidates: 0, processed: 0 })
  })

  it("[9] a sweep/config-load failure does NOT break passes 1-2", async () => {
    vi.mocked(getActiveScoringConfigWithVersion).mockRejectedValue(new Error("config down"))
    vi.mocked(prisma.crmContact.findMany).mockResolvedValue([{ id: "ct-1", email: "a@b.com" }] as never)
    vi.mocked(enrichPerson).mockResolvedValue({ id: "p1" } as never)

    const res = await runApolloEnrichment()
    expect(res).toMatchObject({ processed: 1, enriched: 1 }) // pass-1 unaffected
    expect(res.sweep.dryRun).toBe(true) // left as the safe empty default
  })
})

describe("runEnrichmentSweep (pass 3, slice 4)", () => {
  const candidate = { id: "co-1", name: "Wirex", linkedinUrl: "https://linkedin.com/company/wirex", intentScore: 12 }

  it("[S1] Gate-1 predicate + ordering — the exact index-backed where + intentScore DESC", async () => {
    await runEnrichmentSweep(cfg({ dryRun: true }), 3)
    const args = vi.mocked(prisma.company.findMany).mock.calls.at(-1)![0] as {
      where: Record<string, unknown>
      orderBy: unknown
    }
    expect(args.where).toMatchObject({
      enrichedAt: null,
      domain: null,
      intentScore: { gte: 10 },
      enrichmentAttempts: { lt: 3 }, // 3rd attempt drops the row from the predicate
    })
    expect(args.orderBy).toEqual({ intentScore: "desc" }) // hottest first
  })

  it("[S2] distinctSignals gate — account-level count; below floor → excluded", async () => {
    vi.mocked(prisma.company.findMany).mockResolvedValue([candidate] as never)
    vi.mocked(prisma.intentSignal.count).mockResolvedValue(1 as never) // < gate1MinSignals (2)

    const res = await runEnrichmentSweep(cfg({ dryRun: true }), 3)
    expect(prisma.intentSignal.count).toHaveBeenCalledWith({ where: { companyId: "co-1", contactId: null } })
    expect(res.candidates).toBe(0)
    expect(res.processed).toBe(0)
  })

  it("[S3] monthly cap counts SUCCESSES only (enrichedAt ≥ month-start)", async () => {
    await runEnrichmentSweep(cfg({ dryRun: true }), 3, { now: new Date("2026-07-15T12:00:00Z") })
    expect(prisma.company.count).toHaveBeenCalledWith({
      where: { enrichedAt: { gte: new Date("2026-07-01T00:00:00.000Z") } },
    })
  })

  it("[S4] cap reached → found but processes NONE; remainder untouched (no writes)", async () => {
    vi.mocked(prisma.company.findMany).mockResolvedValue([candidate] as never)
    vi.mocked(prisma.intentSignal.count).mockResolvedValue(2 as never)
    vi.mocked(prisma.company.count).mockResolvedValue(300 as never) // == baseEnrichmentCap

    const res = await runEnrichmentSweep(cfg({ dryRun: false }), 3)
    expect(res).toMatchObject({ candidates: 1, capRemaining: 0, processed: 0, enriched: 0 })
    expect(searchOrganizations).not.toHaveBeenCalled()
    expect(prisma.company.update).not.toHaveBeenCalled()
  })

  it("[S5] DRY-RUN — eligible candidate → ZERO Apollo calls, ZERO writes, would-spend summary", async () => {
    vi.mocked(prisma.company.findMany).mockResolvedValue([candidate] as never)
    vi.mocked(prisma.intentSignal.count).mockResolvedValue(2 as never)

    const res = await runEnrichmentSweep(cfg({ dryRun: true }), 3)
    expect(res).toMatchObject({
      dryRun: true,
      candidates: 1,
      processed: 1,
      wouldSpendCredits: 2,
      creditsSpent: 0,
      enriched: 0,
      contactsCreated: 0,
    })
    // zero Apollo
    expect(searchOrganizations).not.toHaveBeenCalled()
    expect(searchPeople).not.toHaveBeenCalled()
    expect(enrichPerson).not.toHaveBeenCalled()
    expect(enrichOrganization).not.toHaveBeenCalled()
    // zero writes
    expect(upsertCompanyFromApollo).not.toHaveBeenCalled()
    expect(upsertPersonFromApollo).not.toHaveBeenCalled()
    expect(prisma.company.update).not.toHaveBeenCalled()
    expect(recomputeCompanyContacts).not.toHaveBeenCalled()
  })

  it("[S6] absent dryRun flag defaults to TRUE (no-spend)", async () => {
    vi.mocked(prisma.company.findMany).mockResolvedValue([candidate] as never)
    vi.mocked(prisma.intentSignal.count).mockResolvedValue(2 as never)

    const res = await runEnrichmentSweep(cfg(), 3) // no dryRun key
    expect(res.dryRun).toBe(true)
    expect(searchOrganizations).not.toHaveBeenCalled()
  })

  it("[S7] LIVE — full chain: resolve → firmographics → 2 contacts → reveal → recompute + credits", async () => {
    vi.mocked(prisma.company.findMany).mockResolvedValue([candidate] as never)
    vi.mocked(prisma.intentSignal.count).mockResolvedValue(2 as never)
    vi.mocked(searchOrganizations).mockResolvedValue({ id: "o1", primary_domain: "WIREX.com" } as never)
    vi.mocked(enrichOrganization).mockResolvedValue({ id: "o1", name: "Wirex", primary_domain: "wirex.com" } as never)
    vi.mocked(searchPeople).mockResolvedValue([{ id: "p1", name: "Ann Lee", title: "CFO" }] as never)
    vi.mocked(enrichPerson).mockResolvedValue({ id: "p1", name: "Ann Lee", email: "ann@wirex.com" } as never)
    vi.mocked(upsertCompanyFromApollo).mockResolvedValue({ ok: true, action: "updated", companyId: "co-1" } as never)
    vi.mocked(upsertPersonFromApollo).mockResolvedValue({ ok: true, action: "created", contactId: "ct-new" } as never)

    const now = new Date("2026-07-15T00:00:00Z")
    const res = await runEnrichmentSweep(cfg({ dryRun: false }), 3, { now })

    expect(res).toMatchObject({ dryRun: false, candidates: 1, processed: 1, enriched: 1, contactsCreated: 2, creditsSpent: 2, failed: 0 })
    expect(enrichOrganization).toHaveBeenCalledWith({ domain: "wirex.com" }) // lowercased
    expect(searchPeople).toHaveBeenCalledTimes(2) // 2 levels: DM + operational
    expect(searchPeople).toHaveBeenNthCalledWith(1, { organizationId: "o1", titles: ["Chief Compliance Officer"], seniorities: expect.any(Array) })
    expect(searchPeople).toHaveBeenNthCalledWith(2, { organizationId: "o1", titles: ["AML Analyst"], seniorities: expect.any(Array) })
    expect(enrichPerson).toHaveBeenCalledWith({ name: "Ann Lee", domain: "wirex.com" }, { revealEmail: true }) // THE credit step
    expect(upsertPersonFromApollo).toHaveBeenCalledWith({ id: "p1", name: "Ann Lee", email: "ann@wirex.com" }, { companyId: "co-1" })
    expect(recomputeCompanyContacts).toHaveBeenCalledWith("co-1", expect.anything(), 3, now)
    // domain was free → claimed
    expect(prisma.company.update).toHaveBeenCalledWith({ where: { id: "co-1" }, data: { domain: "wirex.com" } })
  })

  it("[S8] LIVE failure — no domain resolved → attempts++ / attemptedAt, NEVER enrichedAt", async () => {
    vi.mocked(prisma.company.findMany).mockResolvedValue([candidate] as never)
    vi.mocked(prisma.intentSignal.count).mockResolvedValue(2 as never)
    vi.mocked(searchOrganizations).mockResolvedValue(null as never) // generic name / no match / 429

    const now = new Date("2026-07-15T00:00:00Z")
    const res = await runEnrichmentSweep(cfg({ dryRun: false }), 3, { now })

    expect(res).toMatchObject({ processed: 1, enriched: 0, failed: 1 })
    expect(prisma.company.update).toHaveBeenCalledWith({
      where: { id: "co-1" },
      data: { enrichmentAttemptedAt: now, enrichmentAttempts: { increment: 1 } },
    })
    const data = vi.mocked(prisma.company.update).mock.calls.at(-1)![0].data as Record<string, unknown>
    expect(data).not.toHaveProperty("enrichedAt") // success-only marker never set on failure
    expect(upsertCompanyFromApollo).not.toHaveBeenCalled()
    expect(enrichPerson).not.toHaveBeenCalled() // no credit burned on a failure
  })

  it("[S9] LIVE domain collision — resolved domain owned by another company → enrich, but leave domain null", async () => {
    vi.mocked(prisma.company.findMany).mockResolvedValue([candidate] as never)
    vi.mocked(prisma.intentSignal.count).mockResolvedValue(2 as never)
    vi.mocked(searchOrganizations).mockResolvedValue({ id: "o1", primary_domain: "wirex.com" } as never)
    vi.mocked(enrichOrganization).mockResolvedValue({ id: "o1", primary_domain: "wirex.com" } as never)
    vi.mocked(prisma.company.findUnique).mockResolvedValue({ id: "other-co" } as never) // domain already owned
    vi.mocked(searchPeople).mockResolvedValue([] as never) // no people → no contacts

    const res = await runEnrichmentSweep(cfg({ dryRun: false }), 3)
    expect(res.enriched).toBe(1) // firmographics + enrichedAt still written (fire-once)
    // domain NOT claimed (would violate @unique) → no company.update with { domain }
    const domainUpdates = vi.mocked(prisma.company.update).mock.calls.filter(
      (c) => (c[0].data as Record<string, unknown>).domain !== undefined,
    )
    expect(domainUpdates).toHaveLength(0)
  })

  it("[S10] empty-set → clean no-op in BOTH modes", async () => {
    for (const dryRun of [true, false]) {
      vi.clearAllMocks()
      vi.mocked(prisma.company.findMany).mockResolvedValue([] as never)
      vi.mocked(prisma.company.count).mockResolvedValue(0 as never)
      const res = await runEnrichmentSweep(cfg({ dryRun }), 3)
      expect(res).toMatchObject({ candidates: 0, processed: 0, enriched: 0, creditsSpent: 0, wouldSpendCredits: 0 })
      expect(searchOrganizations).not.toHaveBeenCalled()
      expect(enrichPerson).not.toHaveBeenCalled()
    }
  })

  it("[S11] pre-v3 config (no enrichment block) → safe no-op, no queries", async () => {
    const res = await runEnrichmentSweep({} as unknown as ScoringConfigBlob, 3)
    expect(res).toMatchObject({ dryRun: true, candidates: 0, processed: 0 })
    expect(prisma.company.findMany).not.toHaveBeenCalled()
  })

  it("[S12] candidate scan is bounded by take:cap (the per-run spend guard)", async () => {
    await runEnrichmentSweep(cfg({ dryRun: true }), 3, { cap: 40 })
    const args = vi.mocked(prisma.company.findMany).mock.calls.at(-1)![0] as { take: number }
    expect(args.take).toBe(40) // ≤40 candidates/run → ≤80 reveal credits/run, regardless of capRemaining
  })

  it("[S13] monthly-cap month-start is UTC even at a month-boundary instant", async () => {
    // 2026-07-31T21:00Z is Aug 1 in a +offset local TZ — a local-time regression
    // would compute an August window here; the UTC impl must stay July 1.
    await runEnrichmentSweep(cfg({ dryRun: true }), 3, { now: new Date("2026-07-31T21:00:00Z") })
    expect(prisma.company.count).toHaveBeenCalledWith({
      where: { enrichedAt: { gte: new Date("2026-07-01T00:00:00.000Z") } },
    })
  })
})
