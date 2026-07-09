/**
 * Tests for the Apollo enrichment client (PR-Y). Mocks global fetch and toggles
 * APOLLO_API_KEY (read at call time). Asserts the guards: success parse,
 * 429-retry, no-match→null, and the credit guard (no key → null AND no fetch).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  enrichPerson,
  enrichOrganization,
  isApolloConfigured,
  searchOrganizations,
  searchPeople,
} from "./apollo"

const fetchMock = vi.fn()

function okJson(body: unknown) {
  return { ok: true, status: 200, json: async () => body, headers: new Headers() }
}
function errStatus(status: number, headers: Record<string, string> = {}) {
  return { ok: false, status, json: async () => ({}), headers: new Headers(headers) }
}

const ORIG_KEY = process.env.APOLLO_API_KEY

describe("apollo client", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.APOLLO_API_KEY = "test-key"
    vi.stubGlobal("fetch", fetchMock)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    if (ORIG_KEY === undefined) delete process.env.APOLLO_API_KEY
    else process.env.APOLLO_API_KEY = ORIG_KEY
  })

  it("[1] enrichPerson success → returns the person; POST /people/match, X-Api-Key, reveal flags false, no waterfall", async () => {
    fetchMock.mockResolvedValue(
      okJson({
        request_id: "r1",
        person: { id: "p1", first_name: "Jane", title: "CFO", organization: { name: "Acme" } },
      }),
    )
    const p = await enrichPerson({ email: "jane@acme.com" })
    expect(p?.id).toBe("p1")
    expect(p?.title).toBe("CFO")
    expect(p?.organization?.name).toBe("Acme")

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toContain("/people/match")
    expect(init.method).toBe("POST")
    expect(init.headers["X-Api-Key"]).toBe("test-key")
    const sent = JSON.parse(init.body)
    expect(sent.email).toBe("jane@acme.com")
    expect(sent.reveal_personal_emails).toBe(false)
    expect(sent.reveal_phone_number).toBe(false)
    expect(sent).not.toHaveProperty("run_waterfall_email")
    expect(sent).not.toHaveProperty("run_waterfall_phone")
  })

  it("[2] enrichPerson name+domain → body carries name+domain, not email", async () => {
    fetchMock.mockResolvedValue(okJson({ person: { id: "p2" } }))
    await enrichPerson({ name: "Jane Doe", domain: "acme.com" })
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(sent.name).toBe("Jane Doe")
    expect(sent.domain).toBe("acme.com")
    expect(sent).not.toHaveProperty("email")
  })

  it("[3] enrichOrganization success → returns the org; GET /organizations/enrich?domain=", async () => {
    fetchMock.mockResolvedValue(okJson({ organization: { id: "o1", name: "Acme", industry: "fintech" } }))
    const o = await enrichOrganization({ domain: "acme.com" })
    expect(o?.name).toBe("Acme")
    expect(o?.industry).toBe("fintech")
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toContain("/organizations/enrich?domain=acme.com")
    expect(init.method).toBe("GET")
  })

  it("[4] 429 then 200 → retry succeeds (2 calls)", async () => {
    fetchMock
      .mockResolvedValueOnce(errStatus(429, { "Retry-After": "0" }))
      .mockResolvedValueOnce(okJson({ person: { id: "p1" } }))
    const p = await enrichPerson({ email: "x@y.com" })
    expect(p?.id).toBe("p1")
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("[5] persistent 429 → null after ~3 attempts", async () => {
    fetchMock.mockResolvedValue(errStatus(429, { "Retry-After": "0" }))
    const p = await enrichPerson({ email: "x@y.com" })
    expect(p).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(3) // 1 + MAX_RETRIES(2)
  })

  it("[6] no-match (person null) and 404 → null", async () => {
    fetchMock.mockResolvedValue(okJson({ request_id: "r", person: null }))
    expect(await enrichPerson({ email: "nobody@nowhere.com" })).toBeNull()

    fetchMock.mockResolvedValue(errStatus(404))
    expect(await enrichOrganization({ domain: "nope.invalid" })).toBeNull()
  })

  it("[7] network error → null (never throws)", async () => {
    fetchMock.mockRejectedValue(new Error("boom"))
    expect(await enrichPerson({ email: "x@y.com" })).toBeNull()
    expect(await enrichOrganization({ domain: "acme.com" })).toBeNull()
  })

  it("[8] credit guard: no APOLLO_API_KEY → null AND no fetch made", async () => {
    delete process.env.APOLLO_API_KEY
    expect(isApolloConfigured()).toBe(false)
    expect(await enrichPerson({ email: "x@y.com" })).toBeNull()
    expect(await enrichOrganization({ domain: "acme.com" })).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  // ─── searchOrganizations (PR3c-b slice 3) ─────────────────────────

  it("[S1] name → org with domain; POST /mixed_companies/search + q_organization_name", async () => {
    fetchMock.mockResolvedValue(
      okJson({ organizations: [{ id: "o1", name: "Wirex", primary_domain: "wirex.com", linkedin_url: "https://linkedin.com/company/wirex" }] }),
    )
    const org = await searchOrganizations({ name: "Wirex" })
    expect(org?.id).toBe("o1")
    expect(org?.primary_domain).toBe("wirex.com")

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toContain("/mixed_companies/search")
    expect(init.method).toBe("POST")
    expect(init.headers["X-Api-Key"]).toBe("test-key")
    expect(JSON.parse(init.body).q_organization_name).toBe("Wirex")
  })

  it("[S2] LinkedIn disambiguation — the linkedin match wins over a closer name", async () => {
    // "Wirex Ltd" name-normalizes closer to the query, but the LinkedIn URL
    // points to the OTHER candidate → linkedin wins (the confident match).
    fetchMock.mockResolvedValue(
      okJson({
        organizations: [
          { id: "wrong", name: "Wirex", primary_domain: "wirex-lookalike.com", linkedin_url: "https://linkedin.com/company/other" },
          { id: "right", name: "Wirex Limited", primary_domain: "wirex.com", linkedin_url: "https://www.LinkedIn.com/company/wirex/" },
        ],
      }),
    )
    const org = await searchOrganizations({ name: "Wirex", linkedinUrl: "https://linkedin.com/company/wirex" })
    expect(org?.id).toBe("right") // canonicalized linkedin match, not the name match
  })

  it("[S3] no confident match (name below 0.85, no linkedin) → null", async () => {
    fetchMock.mockResolvedValue(
      okJson({ organizations: [{ id: "x", name: "Totally Different Corp", primary_domain: "diff.com" }] }),
    )
    expect(await searchOrganizations({ name: "Wirex" })).toBeNull()
  })

  it("[S4] skip-no-key → null AND zero fetch", async () => {
    delete process.env.APOLLO_API_KEY
    expect(await searchOrganizations({ name: "Wirex" })).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("[S5] 429 then 200 → retries and resolves", async () => {
    fetchMock
      .mockResolvedValueOnce(errStatus(429, { "Retry-After": "0" }))
      .mockResolvedValueOnce(okJson({ organizations: [{ id: "o1", name: "Wirex", primary_domain: "wirex.com" }] }))
    const org = await searchOrganizations({ name: "Wirex" })
    expect(org?.id).toBe("o1")
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("[S6] bad body (organizations not an array) → null", async () => {
    fetchMock.mockResolvedValue(okJson({ pagination: { total: 0 } }))
    expect(await searchOrganizations({ name: "Wirex" })).toBeNull()
  })

  it("[S7] linkedinUrl provided but no candidate matches it → falls through to the name match", async () => {
    fetchMock.mockResolvedValue(
      okJson({ organizations: [{ id: "byname", name: "Mercuryo", primary_domain: "mercuryo.io", linkedin_url: "https://linkedin.com/company/someone-else" }] }),
    )
    const org = await searchOrganizations({ name: "Mercuryo", linkedinUrl: "https://linkedin.com/company/mercuryo" })
    expect(org?.id).toBe("byname") // linkedin missed → name (exact, ≥0.85) resolves
  })

  // ─── searchPeople (PR3c-b slice 3) ────────────────────────────────

  it("[P1] titles/seniorities → people list; body carries organization_ids/person_titles/person_seniorities", async () => {
    fetchMock.mockResolvedValue(
      okJson({ people: [{ id: "pp1", name: "Jane", title: "Head of Compliance", seniority: "head" }] }),
    )
    const people = await searchPeople({
      organizationId: "o1",
      titles: ["Head of Compliance", "MLRO"],
      seniorities: ["head", "c_suite"],
    })
    expect(people).toHaveLength(1)
    expect(people?.[0].title).toBe("Head of Compliance")

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toContain("/mixed_people/search")
    const sent = JSON.parse(init.body)
    expect(sent.organization_ids).toEqual(["o1"])
    expect(sent.person_titles).toEqual(["Head of Compliance", "MLRO"])
    expect(sent.person_seniorities).toEqual(["head", "c_suite"])
  })

  it("[P2] empty result → [] (valid, NOT null — null is reserved for error)", async () => {
    fetchMock.mockResolvedValue(okJson({ people: [] }))
    const people = await searchPeople({ organizationId: "o1", titles: ["X"], seniorities: ["head"] })
    expect(people).toEqual([])
  })

  it("[P3] skip-no-key → null AND zero fetch", async () => {
    delete process.env.APOLLO_API_KEY
    expect(await searchPeople({ organizationId: "o1", titles: ["X"], seniorities: ["head"] })).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("[P4] persistent 429 → null after ~3 attempts", async () => {
    fetchMock.mockResolvedValue(errStatus(429, { "Retry-After": "0" }))
    expect(await searchPeople({ organizationId: "o1", titles: ["X"], seniorities: ["head"] })).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it("[P5] bad body (no people key on a 2xx) → null, distinct from empty []", async () => {
    fetchMock.mockResolvedValue(okJson({ pagination: { total: 0 } }))
    expect(await searchPeople({ organizationId: "o1", titles: ["X"], seniorities: ["head"] })).toBeNull()
  })
})
