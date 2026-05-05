/**
 * Integration tests for /api/webhooks/clay-enrichment.
 *
 * Mock strategy:
 * - @/lib/prisma : full mock of company + crmContact + employee tables
 * - @/lib/clay-enrichment : mock assignRandomBD; keep classifyPersona +
 *   extractClayTableSegment as REAL (their unit tests cover them).
 * - CLAY_WEBHOOK_SECRET set in beforeAll for auth path
 *
 * Refs: CLAY_ENRICHMENT_PAYLOAD_DRAFT.md v1.1 sections 4.1, 4.2.
 */

import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  afterAll,
  beforeEach,
} from "vitest"

// ─── Mocks before module-under-test imports ────────────────────────
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

// Keep real classifyPersona + extractClayTableSegment (cf. their unit tests),
// only mock assignRandomBD which depends on DB.
vi.mock("@/lib/clay-enrichment", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/clay-enrichment")>(
      "@/lib/clay-enrichment",
    )
  return {
    ...actual,
    assignRandomBD: vi.fn(),
  }
})

import { POST } from "./route"
import { prisma } from "@/lib/prisma"
import { assignRandomBD } from "@/lib/clay-enrichment"

// ─── Helpers ─────────────────────────────────────────────────────────
const SECRET = "test-clay-secret-32-bytes-deadbeef-cafe"

function makeReq(body: unknown, opts: { secret?: string | null } = {}) {
  const headers = new Headers({ "Content-Type": "application/json" })
  const secretValue =
    opts.secret === undefined ? SECRET : opts.secret === null ? null : opts.secret
  if (secretValue !== null) {
    headers.set("x-webhook-secret", secretValue)
  }
  return new Request("http://localhost/api/webhooks/clay-enrichment", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })
}

const COMPANY_PAYLOAD_VALID = {
  source_table: "vDC_G1_Tier 1_Company_Active Business Loss",
  scope: "company",
  group: "G1",
  pain_tier: "T1",
  company: {
    name: "MidChains",
    description: "Crypto exchange in UAE",
    primaryIndustry: "Financial Services",
    size: "11-50 employees",
    type: "Privately Held",
    location: "Abu Dhabi, Maryah Island",
    country: "United Arab Emirates",
    domain: "MidChains.com",
    linkedinUrl: "https://www.linkedin.com/company/midchains",
  },
}

const PEOPLE_PAYLOAD_VALID = {
  source_table: "vDC_G1_Tier 1_People_Active Business Loss",
  scope: "people",
  group: "G1",
  pain_tier: "T1",
  person: {
    firstName: "Jean-Philippe",
    lastName: "Chetcuti",
    fullName: "Jean-Philippe Chetcuti",
    jobTitle: "CEO",
    email: "JPC@inter-serv.com",
    emailValidationStatus: "valid",
    emailProvider: "Hunter",
    linkedinUrl: "https://www.linkedin.com/in/jpchetcuti",
    location: "Valletta, Malta",
    country: "Malta",
    company: {
      name: "Inter-Serv",
      domain: "Inter-Serv.com",
      linkedinUrl: "https://www.linkedin.com/company/inter-serv",
    },
  },
}

// ─── Setup ────────────────────────────────────────────────────────────
describe("POST /api/webhooks/clay-enrichment", () => {
  const ORIGINAL_SECRET = process.env.CLAY_WEBHOOK_SECRET

  beforeAll(() => {
    process.env.CLAY_WEBHOOK_SECRET = SECRET
  })

  afterAll(() => {
    if (ORIGINAL_SECRET === undefined) {
      delete process.env.CLAY_WEBHOOK_SECRET
    } else {
      process.env.CLAY_WEBHOOK_SECRET = ORIGINAL_SECRET
    }
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ─── Auth ────────────────────────────────────────────────────────────
  it("[1] returns 401 when secret header is missing", async () => {
    const res = await POST(makeReq(COMPANY_PAYLOAD_VALID, { secret: null }))
    expect(res.status).toBe(401)
  })

  // ─── Zod validation ──────────────────────────────────────────────────
  it("[2] returns 400 on invalid scope", async () => {
    const res = await POST(
      makeReq({ ...COMPANY_PAYLOAD_VALID, scope: "invalid-scope" }),
    )
    expect(res.status).toBe(400)
  })

  it("[3] returns 400 when scope=company and company is missing", async () => {
    const { company: _omit, ...withoutCompany } = COMPANY_PAYLOAD_VALID
    void _omit
    const res = await POST(makeReq(withoutCompany))
    expect(res.status).toBe(400)
  })

  it("[4] returns 400 when scope=people and person.email is missing", async () => {
    const broken = {
      ...PEOPLE_PAYLOAD_VALID,
      person: { ...PEOPLE_PAYLOAD_VALID.person, email: undefined },
    }
    const res = await POST(makeReq(broken))
    expect(res.status).toBe(400)
  })

  // ─── scope=company ───────────────────────────────────────────────────
  it("[5] creates a new Company on first payload", async () => {
    vi.mocked(prisma.company.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.company.create).mockResolvedValue({
      id: "co-new-1",
    } as never)

    const res = await POST(makeReq(COMPANY_PAYLOAD_VALID))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({
      success: true,
      action: "created",
      companyId: "co-new-1",
    })
    expect(prisma.company.create).toHaveBeenCalledTimes(1)
    const args = vi.mocked(prisma.company.create).mock.calls[0][0]
    expect(args.data.domain).toBe("midchains.com") // lowercased
    expect(args.data.industry).toBe("Financial Services") // mapped from primaryIndustry
    expect(args.data.group).toBe("G1")
    expect(args.data.painTier).toBe("T1")
    expect(args.data.clayTableSegment).toBe("Active Business Loss")
    expect(args.data.enrichmentSource).toBe("clay")
  })

  it("[6] updates an existing Company by domain", async () => {
    vi.mocked(prisma.company.findUnique).mockResolvedValue({
      id: "co-existing-1",
    } as never)
    vi.mocked(prisma.company.update).mockResolvedValue({
      id: "co-existing-1",
    } as never)

    const res = await POST(makeReq(COMPANY_PAYLOAD_VALID))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({
      success: true,
      action: "updated",
      companyId: "co-existing-1",
    })
    expect(prisma.company.update).toHaveBeenCalledTimes(1)
    expect(prisma.company.create).not.toHaveBeenCalled()
  })

  // ─── scope=people ────────────────────────────────────────────────────
  it("[7] auto-creates Company when scope=people with new domain", async () => {
    vi.mocked(prisma.company.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.company.create).mockResolvedValue({
      id: "co-new-people-1",
    } as never)
    vi.mocked(prisma.crmContact.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.crmContact.create).mockResolvedValue({
      id: "ct-new-1",
    } as never)
    vi.mocked(assignRandomBD).mockResolvedValue("emp-andy-id")
    vi.mocked(prisma.employee.findUnique).mockResolvedValue({
      name: "Andy",
    } as never)

    const res = await POST(makeReq(PEOPLE_PAYLOAD_VALID))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.action).toBe("created")
    expect(body.contactId).toBe("ct-new-1")
    expect(body.companyId).toBe("co-new-people-1")
    expect(prisma.company.create).toHaveBeenCalledTimes(1)
    const companyArgs = vi.mocked(prisma.company.create).mock.calls[0][0]
    expect(companyArgs.data.domain).toBe("inter-serv.com")
  })

  it("[8] creates Contact with companyId=null when person has no company", async () => {
    const noCompanyPayload = {
      ...PEOPLE_PAYLOAD_VALID,
      person: {
        ...PEOPLE_PAYLOAD_VALID.person,
        company: undefined,
      },
    }
    vi.mocked(prisma.crmContact.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.crmContact.create).mockResolvedValue({
      id: "ct-new-2",
    } as never)
    vi.mocked(assignRandomBD).mockResolvedValue(null)

    const res = await POST(makeReq(noCompanyPayload))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.action).toBe("created")
    expect(prisma.company.findUnique).not.toHaveBeenCalled()
    expect(prisma.company.create).not.toHaveBeenCalled()
    const args = vi.mocked(prisma.crmContact.create).mock.calls[0][0]
    expect(args.data.companyId).toBeNull()
  })

  it("[9] updates existing Contact and PRESERVES dealOwner", async () => {
    vi.mocked(prisma.company.findUnique).mockResolvedValue({
      id: "co-existing-people",
    } as never)
    vi.mocked(prisma.company.update).mockResolvedValue({
      id: "co-existing-people",
    } as never)
    vi.mocked(prisma.crmContact.findFirst).mockResolvedValue({
      id: "ct-existing-1",
      dealOwner: "Paul Louis", // already assigned
    } as never)
    vi.mocked(prisma.crmContact.update).mockResolvedValue({
      id: "ct-existing-1",
    } as never)

    const res = await POST(makeReq(PEOPLE_PAYLOAD_VALID))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.action).toBe("updated")
    expect(body.contactId).toBe("ct-existing-1")
    expect(prisma.crmContact.create).not.toHaveBeenCalled()
    expect(assignRandomBD).not.toHaveBeenCalled()
    const updateArgs = vi.mocked(prisma.crmContact.update).mock.calls[0][0]
    // dealOwner is NOT in update data — preserved
    expect("dealOwner" in updateArgs.data).toBe(false)
  })

  it("[10] creates new Contact and assigns random BD", async () => {
    vi.mocked(prisma.company.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.company.create).mockResolvedValue({
      id: "co-new-10",
    } as never)
    vi.mocked(prisma.crmContact.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.crmContact.create).mockResolvedValue({
      id: "ct-new-10",
    } as never)
    vi.mocked(assignRandomBD).mockResolvedValue("emp-paullouis-id")
    vi.mocked(prisma.employee.findUnique).mockResolvedValue({
      name: "Paul Louis",
    } as never)

    const res = await POST(makeReq(PEOPLE_PAYLOAD_VALID))

    expect(res.status).toBe(200)
    expect(assignRandomBD).toHaveBeenCalledTimes(1)
    const createArgs = vi.mocked(prisma.crmContact.create).mock.calls[0][0]
    expect(createArgs.data.dealOwner).toBe("Paul Louis")
    expect(createArgs.data.email).toBe("jpc@inter-serv.com") // lowercased
  })

  // ─── classifyPersona triggered ──────────────────────────────────────
  it('[11] sets persona="DM" when jobTitle="CEO"', async () => {
    vi.mocked(prisma.company.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.company.create).mockResolvedValue({
      id: "co-11",
    } as never)
    vi.mocked(prisma.crmContact.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.crmContact.create).mockResolvedValue({
      id: "ct-11",
    } as never)
    vi.mocked(assignRandomBD).mockResolvedValue(null)

    // PEOPLE_PAYLOAD_VALID already has jobTitle="CEO"
    await POST(makeReq(PEOPLE_PAYLOAD_VALID))

    const args = vi.mocked(prisma.crmContact.create).mock.calls[0][0]
    expect(args.data.persona).toBe("DM")
  })

  it('[12] sets persona="OP" when jobTitle="Software Engineer"', async () => {
    const opPayload = {
      ...PEOPLE_PAYLOAD_VALID,
      person: {
        ...PEOPLE_PAYLOAD_VALID.person,
        jobTitle: "Software Engineer",
      },
    }
    vi.mocked(prisma.company.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.company.create).mockResolvedValue({
      id: "co-12",
    } as never)
    vi.mocked(prisma.crmContact.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.crmContact.create).mockResolvedValue({
      id: "ct-12",
    } as never)
    vi.mocked(assignRandomBD).mockResolvedValue(null)

    await POST(makeReq(opPayload))

    const args = vi.mocked(prisma.crmContact.create).mock.calls[0][0]
    expect(args.data.persona).toBe("OP")
  })
})
