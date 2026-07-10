/**
 * Integration tests for POST /api/signals (Sprint S1 batch 2 —
 * universal signal ingestion endpoint).
 *
 * Verifies:
 *   - Auth: bearer token (valid / invalid / missing) + session fallback
 *   - Zod discriminated union (3 scopes: contact, company, market)
 *   - SignalTypeRegistry strict lookup (400 if unknown code)
 *   - Category-mismatch guard (INTENT type vs market scope, etc.)
 *   - Lifecycle math: expiresAt = occurredAt + decayDays
 *   - customPoints override
 *   - Contact scope auto-denormalizes companyId from CrmContact
 *   - 404 when contactId / companyId not found
 *
 * Mock strategy:
 *   - @/lib/prisma : full mock of signalTypeRegistry, intentSignal,
 *     marketSignal, crmContact, company
 *   - @/lib/admin  : requirePageAccess (session fallback path)
 *   - SIGNALS_INGESTION_SECRET set in beforeAll for fail-closed bypass
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

vi.mock("@/lib/prisma", () => ({
  prisma: {
    signalTypeRegistry: {
      findUnique: vi.fn(),
    },
    intentSignal: {
      create: vi.fn(),
    },
    marketSignal: {
      create: vi.fn(),
    },
    crmContact: {
      findUnique: vi.fn(),
    },
    company: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock("@/lib/admin", () => ({
  requirePageAccess: vi.fn(),
}))

import { POST } from "./route"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"

const SECRET = "test-signals-bearer-32-chars-deadbeef-cafe"

function makeReq(
  body: unknown,
  opts: { bearer?: string | null; sessionAuthed?: boolean } = {},
): Request {
  const headers = new Headers({ "Content-Type": "application/json" })
  if (opts.bearer === undefined) {
    headers.set("authorization", `Bearer ${SECRET}`)
  } else if (opts.bearer !== null) {
    headers.set("authorization", `Bearer ${opts.bearer}`)
  }
  return new Request("http://localhost/api/signals", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })
}

const INTENT_REGISTRY = {
  id: "reg-intent-1",
  code: "clay_business_loss",
  label: "Clay — Active Business Loss",
  description: null,
  defaultPoints: 10,
  decayDays: 90,
  decayCurve: "LINEAR",
  category: "INTENT",
  // Sprint 3a categorical axes — the writer must copy these onto the row.
  intentCategory: "A",
  signalLevel: "contact",
  triggerType: "rapid",
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const MARKET_REGISTRY = {
  id: "reg-market-1",
  code: "market_country_regulation_change",
  label: "Market — Country Regulation Change",
  description: null,
  defaultPoints: 50,
  decayDays: 180,
  decayCurve: "STEP",
  category: "MARKET",
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe("POST /api/signals (Sprint S1 batch 2)", () => {
  const ORIGINAL_SECRET = process.env.SIGNALS_INGESTION_SECRET

  beforeAll(() => {
    process.env.SIGNALS_INGESTION_SECRET = SECRET
  })

  afterAll(() => {
    if (ORIGINAL_SECRET === undefined) {
      delete process.env.SIGNALS_INGESTION_SECRET
    } else {
      process.env.SIGNALS_INGESTION_SECRET = ORIGINAL_SECRET
    }
  })

  beforeEach(() => {
    vi.clearAllMocks()
    // Default: requirePageAccess succeeds (covers the session fallback path)
    vi.mocked(requirePageAccess).mockResolvedValue({
      error: null,
      session: { user: { email: "andy@oxen.finance" } },
      employee: null,
      roleLevel: "admin",
    } as never)
  })

  // ─── Auth ──────────────────────────────────────────────────────────
  it("[1] returns 401 when bearer token is invalid", async () => {
    const res = await POST(
      makeReq({ scope: "contact", contactId: "x", signalTypeCode: "y" }, { bearer: "wrong" }),
    )
    expect(res.status).toBe(401)
    expect(prisma.signalTypeRegistry.findUnique).not.toHaveBeenCalled()
  })

  it("[2] falls back to session auth when no bearer header", async () => {
    vi.mocked(requirePageAccess).mockResolvedValue({
      error: new Response("Forbidden", { status: 403 }),
    } as never)
    const res = await POST(
      makeReq({ scope: "contact", contactId: "x", signalTypeCode: "y" }, { bearer: null }),
    )
    // Session denied → session error returned (403 here).
    expect(res.status).toBe(403)
  })

  it("[3] succeeds with valid bearer (no session needed)", async () => {
    vi.mocked(prisma.signalTypeRegistry.findUnique).mockResolvedValue(
      INTENT_REGISTRY as never,
    )
    vi.mocked(prisma.crmContact.findUnique).mockResolvedValue({
      id: "ct-1",
      companyId: "co-1",
    } as never)
    vi.mocked(prisma.intentSignal.create).mockResolvedValue({
      id: "sig-1",
    } as never)

    const res = await POST(
      makeReq({
        scope: "contact",
        contactId: "ct-1",
        signalTypeCode: "clay_business_loss",
      }),
    )
    expect(res.status).toBe(200)
    // Session NOT consulted because bearer is valid
    expect(requirePageAccess).not.toHaveBeenCalled()
  })

  // ─── Zod validation ────────────────────────────────────────────────
  it("[4] returns 400 on invalid scope", async () => {
    const res = await POST(
      makeReq({ scope: "invalid_scope", signalTypeCode: "x" }),
    )
    expect(res.status).toBe(400)
  })

  it("[5] returns 400 when scope=contact missing contactId", async () => {
    const res = await POST(
      makeReq({ scope: "contact", signalTypeCode: "clay_business_loss" }),
    )
    expect(res.status).toBe(400)
  })

  it("[6] returns 400 when scope=market missing country", async () => {
    const res = await POST(
      makeReq({
        scope: "market",
        signalTypeCode: "market_country_regulation_change",
      }),
    )
    expect(res.status).toBe(400)
  })

  // ─── Strict registry lookup ───────────────────────────────────────
  it("[7] returns 400 when signalTypeCode is not in SignalTypeRegistry", async () => {
    vi.mocked(prisma.signalTypeRegistry.findUnique).mockResolvedValue(null)
    const res = await POST(
      makeReq({
        scope: "contact",
        contactId: "ct-1",
        signalTypeCode: "unknown_code",
      }),
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe("Unknown signal type code")
    expect(prisma.intentSignal.create).not.toHaveBeenCalled()
  })

  it("[8] returns 400 when registry entry is inactive", async () => {
    vi.mocked(prisma.signalTypeRegistry.findUnique).mockResolvedValue({
      ...INTENT_REGISTRY,
      isActive: false,
    } as never)
    const res = await POST(
      makeReq({
        scope: "contact",
        contactId: "ct-1",
        signalTypeCode: "clay_business_loss",
      }),
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe("Signal type is inactive")
  })

  // ─── Category-mismatch guard ──────────────────────────────────────
  it("[9] returns 400 when scope=market but registry category=INTENT", async () => {
    vi.mocked(prisma.signalTypeRegistry.findUnique).mockResolvedValue(
      INTENT_REGISTRY as never,
    )
    const res = await POST(
      makeReq({
        scope: "market",
        country: "United Arab Emirates",
        signalTypeCode: "clay_business_loss", // INTENT registry, but market scope
      }),
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe("Signal type category mismatch")
  })

  it("[10] returns 400 when scope=contact but registry category=MARKET", async () => {
    vi.mocked(prisma.signalTypeRegistry.findUnique).mockResolvedValue(
      MARKET_REGISTRY as never,
    )
    const res = await POST(
      makeReq({
        scope: "contact",
        contactId: "ct-1",
        signalTypeCode: "market_country_regulation_change", // MARKET, but contact scope
      }),
    )
    expect(res.status).toBe(400)
  })

  // ─── Happy paths per scope ────────────────────────────────────────
  it("[11] scope=contact happy path — denormalizes companyId from CrmContact", async () => {
    vi.mocked(prisma.signalTypeRegistry.findUnique).mockResolvedValue(
      INTENT_REGISTRY as never,
    )
    vi.mocked(prisma.crmContact.findUnique).mockResolvedValue({
      id: "ct-42",
      companyId: "co-42",
    } as never)
    vi.mocked(prisma.intentSignal.create).mockResolvedValue({
      id: "sig-42",
      contactId: "ct-42",
      companyId: "co-42",
      points: 10,
    } as never)

    const res = await POST(
      makeReq({
        scope: "contact",
        contactId: "ct-42",
        signalTypeCode: "clay_business_loss",
      }),
    )
    expect(res.status).toBe(200)
    const args = vi.mocked(prisma.intentSignal.create).mock.calls[0][0]
    expect(args.data.contactId).toBe("ct-42")
    expect(args.data.companyId).toBe("co-42") // ← denormalized
    expect(args.data.signalTypeId).toBe("reg-intent-1")
    expect(args.data.points).toBe(10) // default from registry
    // Allumage gate — categorical axes copied from the registry onto the row.
    expect(args.data.intentCategory).toBe("A")
    expect(args.data.signalLevel).toBe("contact")
  })

  it("[12] scope=company happy path — companyId set, contactId null", async () => {
    vi.mocked(prisma.signalTypeRegistry.findUnique).mockResolvedValue(
      INTENT_REGISTRY as never,
    )
    vi.mocked(prisma.company.findUnique).mockResolvedValue({
      id: "co-99",
    } as never)
    vi.mocked(prisma.intentSignal.create).mockResolvedValue({
      id: "sig-99",
    } as never)

    const res = await POST(
      makeReq({
        scope: "company",
        companyId: "co-99",
        signalTypeCode: "clay_business_loss",
      }),
    )
    expect(res.status).toBe(200)
    const args = vi.mocked(prisma.intentSignal.create).mock.calls[0][0]
    expect(args.data.companyId).toBe("co-99")
    expect(args.data.contactId).toBeNull()
  })

  it("[13] scope=market happy path with vertical → MarketSignal", async () => {
    vi.mocked(prisma.signalTypeRegistry.findUnique).mockResolvedValue(
      MARKET_REGISTRY as never,
    )
    vi.mocked(prisma.marketSignal.create).mockResolvedValue({
      id: "msig-1",
    } as never)

    const res = await POST(
      makeReq({
        scope: "market",
        country: "Cyprus",
        vertical: "FinTech/Crypto",
        signalTypeCode: "market_country_regulation_change",
      }),
    )
    expect(res.status).toBe(200)
    expect(prisma.marketSignal.create).toHaveBeenCalledTimes(1)
    expect(prisma.intentSignal.create).not.toHaveBeenCalled()
    const args = vi.mocked(prisma.marketSignal.create).mock.calls[0][0]
    expect(args.data.country).toBe("Cyprus")
    expect(args.data.vertical).toBe("FinTech/Crypto")
    expect(args.data.points).toBe(50) // default from MARKET_REGISTRY
  })

  it("[14] scope=market without vertical is allowed", async () => {
    vi.mocked(prisma.signalTypeRegistry.findUnique).mockResolvedValue(
      MARKET_REGISTRY as never,
    )
    vi.mocked(prisma.marketSignal.create).mockResolvedValue({
      id: "msig-2",
    } as never)

    const res = await POST(
      makeReq({
        scope: "market",
        country: "Malta",
        signalTypeCode: "market_country_regulation_change",
      }),
    )
    expect(res.status).toBe(200)
    const args = vi.mocked(prisma.marketSignal.create).mock.calls[0][0]
    expect(args.data.vertical).toBeNull()
  })

  // ─── Lifecycle + override ─────────────────────────────────────────
  it("[15] computes expiresAt = occurredAt + decayDays", async () => {
    vi.mocked(prisma.signalTypeRegistry.findUnique).mockResolvedValue(
      INTENT_REGISTRY as never, // decayDays = 90
    )
    vi.mocked(prisma.crmContact.findUnique).mockResolvedValue({
      id: "ct-1",
      companyId: null,
    } as never)
    vi.mocked(prisma.intentSignal.create).mockResolvedValue({
      id: "sig-x",
    } as never)

    const occurredAt = "2026-01-01T00:00:00Z"
    // Mirror deriveLifecycle EXACTLY: occurredAt.getTime() + decayDays * MS_PER_DAY
    // (absolute ms). NOT calendar-local setDate(+90) — that keeps the same wall-clock
    // time and so drifts ±1h across a DST boundary (Jan→Apr), which made this red on a
    // DST-observing local TZ and green only in CI's UTC. decayDays = 90 (INTENT_REGISTRY).
    const MS_PER_DAY = 1000 * 60 * 60 * 24
    const expectedExpiry = new Date(new Date(occurredAt).getTime() + 90 * MS_PER_DAY)

    await POST(
      makeReq({
        scope: "contact",
        contactId: "ct-1",
        signalTypeCode: "clay_business_loss",
        occurredAt,
      }),
    )
    const args = vi.mocked(prisma.intentSignal.create).mock.calls[0][0]
    expect((args.data.expiresAt as Date).toISOString()).toBe(
      expectedExpiry.toISOString(),
    )
    expect((args.data.createdAt as Date).toISOString()).toBe(
      new Date(occurredAt).toISOString(),
    )
  })

  it("[16] customPoints overrides registry defaultPoints", async () => {
    vi.mocked(prisma.signalTypeRegistry.findUnique).mockResolvedValue(
      INTENT_REGISTRY as never, // defaultPoints = 10
    )
    vi.mocked(prisma.crmContact.findUnique).mockResolvedValue({
      id: "ct-1",
      companyId: null,
    } as never)
    vi.mocked(prisma.intentSignal.create).mockResolvedValue({
      id: "sig-y",
    } as never)

    await POST(
      makeReq({
        scope: "contact",
        contactId: "ct-1",
        signalTypeCode: "clay_business_loss",
        customPoints: 75,
      }),
    )
    const args = vi.mocked(prisma.intentSignal.create).mock.calls[0][0]
    expect(args.data.points).toBe(75) // ← override, not 10
  })

  // ─── 404 paths ────────────────────────────────────────────────────
  it("[17] returns 404 when contactId not found in DB", async () => {
    vi.mocked(prisma.signalTypeRegistry.findUnique).mockResolvedValue(
      INTENT_REGISTRY as never,
    )
    vi.mocked(prisma.crmContact.findUnique).mockResolvedValue(null)

    const res = await POST(
      makeReq({
        scope: "contact",
        contactId: "ct-ghost",
        signalTypeCode: "clay_business_loss",
      }),
    )
    expect(res.status).toBe(404)
    expect(prisma.intentSignal.create).not.toHaveBeenCalled()
  })

  it("[18] returns 404 when companyId not found in DB", async () => {
    vi.mocked(prisma.signalTypeRegistry.findUnique).mockResolvedValue(
      INTENT_REGISTRY as never,
    )
    vi.mocked(prisma.company.findUnique).mockResolvedValue(null)

    const res = await POST(
      makeReq({
        scope: "company",
        companyId: "co-ghost",
        signalTypeCode: "clay_business_loss",
      }),
    )
    expect(res.status).toBe(404)
    expect(prisma.intentSignal.create).not.toHaveBeenCalled()
  })

  // ─── Allumage gate — uncategorized placeholder stays null ─────────
  it("[19] stamps null intentCategory for a placeholder (uncategorized) registry entry", async () => {
    vi.mocked(prisma.signalTypeRegistry.findUnique).mockResolvedValue({
      ...INTENT_REGISTRY,
      code: "clay_legacy_intent",
      intentCategory: null, // legacy / un-categorized — must pass through as null
      signalLevel: "contact",
    } as never)
    vi.mocked(prisma.crmContact.findUnique).mockResolvedValue({
      id: "ct-ph",
      companyId: null,
    } as never)
    vi.mocked(prisma.intentSignal.create).mockResolvedValue({
      id: "sig-ph",
    } as never)

    const res = await POST(
      makeReq({
        scope: "contact",
        contactId: "ct-ph",
        signalTypeCode: "clay_legacy_intent",
      }),
    )
    expect(res.status).toBe(200)
    const args = vi.mocked(prisma.intentSignal.create).mock.calls[0][0]
    // Null category passes through → computeIntentScore correctly skips it.
    expect(args.data.intentCategory).toBeNull()
    expect(args.data.signalLevel).toBe("contact")
  })
})
