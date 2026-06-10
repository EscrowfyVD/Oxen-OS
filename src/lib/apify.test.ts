/**
 * Tests for the Apify dataset client (PR3a-wiring). Mocks global fetch + toggles
 * APIFY_API_TOKEN (read at call time). Guards: success parse, no-key→[]+no-fetch,
 * 429-retry, empty/non-array→[], network→[].
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { fetchDatasetItems, isApifyConfigured } from "./apify"

const fetchMock = vi.fn()
function okJson(body: unknown) {
  return { ok: true, status: 200, json: async () => body, headers: new Headers() }
}
function errStatus(status: number, headers: Record<string, string> = {}) {
  return { ok: false, status, json: async () => ({}), headers: new Headers(headers) }
}

const ORIG = process.env.APIFY_API_TOKEN

describe("apify client", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.APIFY_API_TOKEN = "test-token"
    vi.stubGlobal("fetch", fetchMock)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    if (ORIG === undefined) delete process.env.APIFY_API_TOKEN
    else process.env.APIFY_API_TOKEN = ORIG
  })

  it("[1] success → items; GET /v2/datasets/{id}/items with token+format+limit", async () => {
    fetchMock.mockResolvedValue(okJson([{ url: "http://a" }, { url: "http://b" }]))
    const items = await fetchDatasetItems("ds_1", { limit: 500 })
    expect(items).toHaveLength(2)
    const url = fetchMock.mock.calls[0][0] as string
    expect(url).toContain("/v2/datasets/ds_1/items")
    expect(url).toContain("token=test-token")
    expect(url).toContain("format=json")
    expect(url).toContain("limit=500")
  })

  it("[2] no-key → [] AND no fetch (credit/no-op guard)", async () => {
    delete process.env.APIFY_API_TOKEN
    expect(isApifyConfigured()).toBe(false)
    expect(await fetchDatasetItems("ds_1")).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("[3] 429 then 200 → retry succeeds", async () => {
    fetchMock
      .mockResolvedValueOnce(errStatus(429, { "Retry-After": "0" }))
      .mockResolvedValueOnce(okJson([{ url: "x" }]))
    expect(await fetchDatasetItems("ds_1")).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("[3b] persistent 429 → [] after ~3 attempts", async () => {
    fetchMock.mockResolvedValue(errStatus(429, { "Retry-After": "0" }))
    expect(await fetchDatasetItems("ds_1")).toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(3) // 1 + 2 retries
  })

  it("[4] empty / non-array body → []", async () => {
    fetchMock.mockResolvedValue(okJson({ not: "an array" }))
    expect(await fetchDatasetItems("ds_1")).toEqual([])
  })

  it("[5] network error and 4xx → []", async () => {
    fetchMock.mockRejectedValue(new Error("boom"))
    expect(await fetchDatasetItems("ds_1")).toEqual([])
    fetchMock.mockReset()
    fetchMock.mockResolvedValue(errStatus(404))
    expect(await fetchDatasetItems("ds_1")).toEqual([])
  })
})
