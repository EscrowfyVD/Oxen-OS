/**
 * Tests for the Apollo → Oxen upsert mappers (PR-Z). Mocks prisma; the pure
 * helpers (classifyPersona, extractCountryFromLocation) run for real.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    company: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
    crmContact: { update: vi.fn() },
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
})
