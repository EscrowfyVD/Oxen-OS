/**
 * Tests for the Company.acquisitionSource backfill (Apify PR3c-b). Mock the
 * Prisma client at the model level — assert what the script SENDS (the apify-only
 * + NULL-source filters, the earliest-category-wins mapping, dry-run vs --apply).
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { backfillCompanyAcquisitionSource } from "./backfill-company-acquisition-source"

function makeClient() {
  const findManyPS = vi.fn()
  const findManyCo = vi.fn()
  const updateCo = vi.fn().mockResolvedValue({})
  const client = {
    processedSignal: { findMany: findManyPS },
    company: { findMany: findManyCo, update: updateCo },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
  return { client, findManyPS, findManyCo, updateCo }
}

const d = (s: string) => new Date(s)

describe("backfillCompanyAcquisitionSource", () => {
  let mock: ReturnType<typeof makeClient>
  beforeEach(() => {
    mock = makeClient()
    // apify signals, asc by processedAt. co-both has crunchbase EARLIER then
    // jobboard LATER → earliest (crunchbase) must win.
    mock.findManyPS.mockResolvedValue([
      { accountId: "co-cb", signalCategory: "crunchbase-f", processedAt: d("2026-07-10T11:00:00Z") },
      { accountId: "co-both", signalCategory: "crunchbase-f", processedAt: d("2026-07-10T11:05:00Z") },
      { accountId: "co-jb", signalCategory: "jobboard-g", processedAt: d("2026-07-10T11:08:00Z") },
      { accountId: "co-both", signalCategory: "jobboard-g", processedAt: d("2026-07-10T11:09:00Z") },
    ])
    // NULL-source apify companies (an already-set one would be excluded by the
    // acquisitionSource:null filter, so the mock simply doesn't return it).
    mock.findManyCo.mockResolvedValue([
      { id: "co-cb", name: "FinBursa" },
      { id: "co-both", name: "CNTXT" },
      { id: "co-jb", name: "Manpower Malta" },
    ])
  })

  it("[1] queries apify signals + only NULL-source apify companies (non-apify & already-set excluded)", async () => {
    await backfillCompanyAcquisitionSource(mock.client)
    expect(mock.findManyPS).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { signalCategory: { in: ["crunchbase-f", "jobboard-g"] }, accountId: { not: null } },
      }),
    )
    const coArgs = mock.findManyCo.mock.calls[0][0]
    expect(coArgs.where.acquisitionSource).toBeNull() // idempotent — skips already-set
    expect([...coArgs.where.id.in].sort()).toEqual(["co-both", "co-cb", "co-jb"]) // only apify-linked
  })

  it("[2] DRY-RUN (default) → zero writes; wouldMark + breakdown (earliest category wins)", async () => {
    const r = await backfillCompanyAcquisitionSource(mock.client)
    expect(mock.updateCo).not.toHaveBeenCalled()
    expect(r).toMatchObject({
      apifyLinkedCompanies: 3,
      wouldMark: 3,
      marked: 0,
      breakdown: { "apify-crunchbase": 2, "apify-jobboard": 1 }, // co-both = crunchbase (earlier signal)
    })
  })

  it("[3] --apply → marks each with the right source; co-both = apify-crunchbase (earliest wins)", async () => {
    const r = await backfillCompanyAcquisitionSource(mock.client, { apply: true })
    expect(mock.updateCo).toHaveBeenCalledTimes(3)
    expect(mock.updateCo).toHaveBeenCalledWith({ where: { id: "co-cb" }, data: { acquisitionSource: "apify-crunchbase" } })
    expect(mock.updateCo).toHaveBeenCalledWith({ where: { id: "co-jb" }, data: { acquisitionSource: "apify-jobboard" } })
    expect(mock.updateCo).toHaveBeenCalledWith({ where: { id: "co-both" }, data: { acquisitionSource: "apify-crunchbase" } })
    expect(r.marked).toBe(3)
  })

  it("[4] idempotent — all already set (no NULL-source rows) → 0 marked, no writes", async () => {
    mock.findManyCo.mockResolvedValue([]) // the acquisitionSource:null filter returns nothing
    const r = await backfillCompanyAcquisitionSource(mock.client, { apply: true })
    expect(mock.updateCo).not.toHaveBeenCalled()
    expect(r).toMatchObject({ wouldMark: 0, marked: 0, apifyLinkedCompanies: 3 })
  })

  it("[5] no apify signals at all → no company query, no writes", async () => {
    mock.findManyPS.mockResolvedValue([])
    const r = await backfillCompanyAcquisitionSource(mock.client, { apply: true })
    expect(mock.findManyCo).not.toHaveBeenCalled()
    expect(r).toMatchObject({ apifyLinkedCompanies: 0, wouldMark: 0, marked: 0 })
  })
})
