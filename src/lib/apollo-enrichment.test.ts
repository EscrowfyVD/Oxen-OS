/**
 * Tests for the Apollo → Oxen upsert mappers (PR-Z). Mocks prisma; the pure
 * helpers (classifyPersona, extractCountryFromLocation) run for real.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    company: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
    crmContact: { update: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    employee: { findMany: vi.fn(), findUnique: vi.fn() },
  },
}))

import { upsertCompanyFromApollo, upsertPersonFromApollo } from "./apollo-enrichment"
import { prisma } from "@/lib/prisma"
import type { ApolloOrg, ApolloPerson } from "./apollo"

const ORG: ApolloOrg = {
  id: "o1",
  name: "Acme",
  primary_domain: "acme.com",
  website_url: "https://acme.com",
  industry: "financial services",
  short_description: "Acme does things.",
  estimated_num_employees: 120,
  annual_revenue_printed: "$5M",
  total_funding_printed: "$2M",
  technology_names: ["AWS", "Stripe"],
  city: "Valletta",
  state: "Malta",
  country: "Malta",
  linkedin_url: "https://linkedin.com/company/acme",
}

describe("apollo-enrichment mappers", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.company.findUnique).mockResolvedValue(null as never)
    vi.mocked(prisma.company.create).mockResolvedValue({ id: "co-new" } as never)
    vi.mocked(prisma.company.update).mockResolvedValue({} as never)
    vi.mocked(prisma.crmContact.update).mockResolvedValue({} as never)
    vi.mocked(prisma.crmContact.findFirst).mockResolvedValue(null as never)
    vi.mocked(prisma.crmContact.create).mockResolvedValue({ id: "ct-new" } as never)
  })

  it("[1] upsertCompanyFromApollo new domain → create with mapped firmographics + apollo marker + raw", async () => {
    const r = await upsertCompanyFromApollo(ORG)
    expect(r).toMatchObject({ ok: true, action: "created", companyId: "co-new" })
    const data = vi.mocked(prisma.company.create).mock.calls[0][0].data as Record<string, unknown>
    expect(data.name).toBe("Acme")
    expect(data.domain).toBe("acme.com")
    expect(data.industry).toBe("financial services")
    expect(data.employeeCount).toBe(120)
    expect(data.revenueRange).toBe("$5M")
    expect(data.fundingTotal).toBe("$2M")
    expect(data.techStack).toEqual(["AWS", "Stripe"])
    expect(data.hqCity).toBe("Valletta")
    expect(data.location).toBe("Valletta, Malta, Malta")
    expect(data.enrichmentSource).toBe("apollo")
    expect(data.enrichedAt).toBeInstanceOf(Date)
    expect(data.enrichmentRaw).toBe(ORG)
  })

  it("[2] existing + unenriched → update; [3] existing + already-enriched → skip (no clobber)", async () => {
    vi.mocked(prisma.company.findUnique).mockResolvedValueOnce({ id: "co1", enrichedAt: null } as never)
    expect(await upsertCompanyFromApollo(ORG)).toMatchObject({ action: "updated", companyId: "co1" })
    expect(prisma.company.update).toHaveBeenCalledTimes(1)

    vi.clearAllMocks()
    vi.mocked(prisma.company.findUnique).mockResolvedValueOnce({ id: "co1", enrichedAt: new Date() } as never)
    expect(await upsertCompanyFromApollo(ORG)).toMatchObject({ action: "skipped", companyId: "co1" })
    expect(prisma.company.update).not.toHaveBeenCalled()
  })

  it("[4] opts.companyId → update by id (secondary pass); [5] no domain → skipped, no write", async () => {
    expect(await upsertCompanyFromApollo(ORG, { companyId: "co-fixed" })).toMatchObject({
      action: "updated",
      companyId: "co-fixed",
    })
    expect(prisma.company.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "co-fixed" } }),
    )

    vi.clearAllMocks()
    const r = await upsertCompanyFromApollo({ name: "NoDomain" } as ApolloOrg)
    expect(r).toMatchObject({ action: "skipped", companyId: null })
    expect(prisma.company.create).not.toHaveBeenCalled()
    expect(prisma.company.update).not.toHaveBeenCalled()
  })

  it("[6] upsertPersonFromApollo updates the contact by id + links free company from person.organization", async () => {
    const person: ApolloPerson = {
      id: "p1",
      first_name: "Jane",
      last_name: "Doe",
      title: "Chief Financial Officer",
      linkedin_url: "https://linkedin.com/in/jane",
      city: "Valletta",
      state: "Malta",
      country: "Malta",
      organization: ORG,
    }
    const r = await upsertPersonFromApollo(person, { contactId: "ct-1" })
    expect(r).toMatchObject({ ok: true, action: "updated", contactId: "ct-1", companyId: "co-new" })

    const upd = vi.mocked(prisma.crmContact.update).mock.calls[0][0] as {
      where: { id: string }
      data: Record<string, unknown>
    }
    expect(upd.where.id).toBe("ct-1")
    expect(upd.data.jobTitle).toBe("Chief Financial Officer")
    expect(upd.data.country).toBe("Malta")
    expect(upd.data.companyId).toBe("co-new")
    expect(upd.data.enrichmentSource).toBe("apollo")
    expect(upd.data.enrichedAt).toBeInstanceOf(Date)
    expect(upd.data.enrichmentRaw).toBe(person)
    // linked company enriched for free (no separate org/enrich call)
    expect(prisma.company.create).toHaveBeenCalledTimes(1)
  })

  it("[7] country inherits from the linked company when person.country is absent", async () => {
    vi.mocked(prisma.company.findUnique)
      .mockResolvedValueOnce(null as never) // org upsert: new company
      .mockResolvedValueOnce({ country: "Cyprus" } as never) // country inherit lookup
    const person: ApolloPerson = {
      id: "p2",
      title: "Director",
      organization: { primary_domain: "x.com", name: "X" },
    }
    await upsertPersonFromApollo(person, { contactId: "ct-2" })
    const data = vi.mocked(prisma.crmContact.update).mock.calls[0][0].data as Record<string, unknown>
    expect(data.country).toBe("Cyprus")
  })

  it("[8] no organization → company link left untouched (companyId undefined, no company write)", async () => {
    const person: ApolloPerson = { id: "p3", title: "Analyst" }
    await upsertPersonFromApollo(person, { contactId: "ct-3" })
    const data = vi.mocked(prisma.crmContact.update).mock.calls[0][0].data as Record<string, unknown>
    expect(data.companyId).toBeUndefined() // never nulls an existing link
    expect(prisma.company.create).not.toHaveBeenCalled()
    expect(prisma.company.update).not.toHaveBeenCalled()
  })

  // ─── {companyId} CREATE-or-LINK path (slice-4 sweep) ───
  it("[9] {companyId} + revealed email → CREATES a contact linked to the caller's company (no re-derive)", async () => {
    const person: ApolloPerson = {
      id: "p9",
      first_name: "Ann",
      last_name: "Lee",
      title: "CFO",
      email: "Ann@Wirex.com",
      organization: { id: "o-other", primary_domain: "other.com" }, // MUST be ignored on this path
    }
    const r = await upsertPersonFromApollo(person, { companyId: "co-1" })
    expect(r).toMatchObject({ ok: true, action: "created", contactId: "ct-new", companyId: "co-1" })
    // did NOT re-derive/create a company from person.organization
    expect(prisma.company.create).not.toHaveBeenCalled()
    const data = vi.mocked(prisma.crmContact.create).mock.calls[0][0].data as Record<string, unknown>
    expect(data.email).toBe("ann@wirex.com") // normalized lower-case
    expect(data.companyId).toBe("co-1")
    expect(data.firstName).toBe("Ann")
    expect(data.enrichmentSource).toBe("apollo")
    expect(data.enrichedAt).toBeInstanceOf(Date)
  })

  it("[10] {companyId} + email already exists (unlinked) → LINKS (updates), no create; lookup is case-INSENSITIVE", async () => {
    vi.mocked(prisma.crmContact.findFirst).mockResolvedValueOnce({ id: "ct-existing", companyId: null } as never)
    const person: ApolloPerson = { id: "p10", first_name: "Bo", email: "Bo@Wirex.com" }
    const r = await upsertPersonFromApollo(person, { companyId: "co-1" })
    expect(r).toMatchObject({ ok: true, action: "updated", contactId: "ct-existing", companyId: "co-1" })
    expect(prisma.crmContact.create).not.toHaveBeenCalled()
    // case-insensitive match against the case-sensitive @unique index → no duplicate
    expect(prisma.crmContact.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: { equals: "bo@wirex.com", mode: "insensitive" } } }),
    )
    expect(prisma.crmContact.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "ct-existing" } }))
  })

  it("[11] {companyId} + NO revealed email → {ok:false}, nothing written", async () => {
    const person: ApolloPerson = { id: "p11", first_name: "No", last_name: "Email" }
    const r = await upsertPersonFromApollo(person, { companyId: "co-1" })
    expect(r).toEqual({ ok: false, error: expect.stringContaining("no revealed email") })
    expect(prisma.crmContact.create).not.toHaveBeenCalled()
    expect(prisma.crmContact.update).not.toHaveBeenCalled()
  })

  it("[12] {companyId} + email belongs to a DIFFERENT company → SKIP (no hijack, no overwrite)", async () => {
    vi.mocked(prisma.crmContact.findFirst).mockResolvedValueOnce({ id: "ct-x", companyId: "other-co" } as never)
    const person: ApolloPerson = { id: "p12", first_name: "Bob", email: "bob@acme.com" }
    const r = await upsertPersonFromApollo(person, { companyId: "co-1" })
    expect(r).toMatchObject({ ok: true, action: "skipped", contactId: "ct-x", companyId: "other-co" })
    expect(prisma.crmContact.update).not.toHaveBeenCalled() // not moved, not nulled
    expect(prisma.crmContact.create).not.toHaveBeenCalled()
  })
})
