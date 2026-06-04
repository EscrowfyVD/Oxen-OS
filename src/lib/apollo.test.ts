/**
 * Tests for the Apollo enrichment client (PR-Y). Mocks global fetch and toggles
 * APOLLO_API_KEY (read at call time). Asserts the guards: success parse,
 * 429-retry, no-match→null, and the credit guard (no key → null AND no fetch).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { enrichPerson, enrichOrganization, isApolloConfigured } from "./apollo"

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
})
