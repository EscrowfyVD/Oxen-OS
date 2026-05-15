/**
 * Integration tests for /api/webhooks/trigify (Sprint Trigify Phase 2A).
 *
 * Mock strategy:
 * - @/lib/prisma : full mock of crmContact + company + signalTypeRegistry +
 *   intentSignal tables.
 * - @/lib/telegram : partial mock — escHtml stays real, notifyEmployee
 *   stubbed so we can assert broadcast cardinality without hitting the
 *   Telegram API.
 * - Matching / dedup / alerts helpers (src/lib/trigify-*.ts) run real
 *   against the mocked prisma so the route is exercised end-to-end.
 *
 * Refs: PRD-002 Trigify Pre-Spec v1.1, Brief Trigify Andy.
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

// ── Mocks before module-under-test imports ──────────────────────────
vi.mock("@/lib/prisma", () => ({
  prisma: {
    crmContact: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    company: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    signalTypeRegistry: {
      findUnique: vi.fn(),
    },
    intentSignal: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}))

vi.mock("@/lib/telegram", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/telegram")>("@/lib/telegram")
  return {
    ...actual,
    notifyEmployee: vi.fn().mockResolvedValue(true),
  }
})

import { POST } from "./route"
import { prisma } from "@/lib/prisma"
import * as telegram from "@/lib/telegram"

// ── Helpers ─────────────────────────────────────────────────────────
const SECRET = "test-trigify-secret-32-bytes-deadbeef-cafe"

function makeReq(body: unknown, opts: { secret?: string | null } = {}) {
  const headers = new Headers({ "Content-Type": "application/json" })
  const secretValue =
    opts.secret === undefined
      ? SECRET
      : opts.secret === null
        ? null
        : opts.secret
  if (secretValue !== null) {
    headers.set("x-webhook-secret", secretValue)
  }
  return new Request("http://localhost/api/webhooks/trigify", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })
}

// Canonical Phase 2A payload (matches Trigify "Get Post Likes LinkedIn"
// workflow output shape — see Brief Trigify Andy 2026-05-14).
const TRIGIFY_PAYLOAD_VALID = {
  signal_type: "competitor_engagement",
  signal_source: "trigify",
  person_name: "Jean-Philippe Chetcuti",
  person_linkedin_url: "https://www.linkedin.com/in/jpchetcuti",
  person_title: "CFO",
  signal_detail: "Liked competitor post",
  post_url: "https://www.linkedin.com/feed/update/urn:li:activity:123",
  post_text: "We're hiring in Malta!",
  competitor_name: "Inter-Serv",
  signal_date: "2026-05-15T10:00:00.000Z",
  intent_score_points: 6,
}

// Legacy Sprint S1 payload (backward compat — curl tests still use it).
const LEGACY_PAYLOAD_VALID = {
  email: "legacy@example.com",
  signal_type: "competitor_engagement",
  name: "Legacy User",
  title: "CEO",
  detail: "Tested via curl",
  score: 10,
  company: "Example Corp",
}

// Mock SignalTypeRegistry entries — returned by the findUnique stub.
const REGISTRY_ENTRIES: Record<string, unknown> = {
  trigify_competitor_engagement: {
    id: "reg-comp",
    code: "trigify_competitor_engagement",
    label: "Trigify — Competitor engagement",
    category: "INTENT",
    defaultPoints: 6,
    decayDays: 60,
    decayCurve: "LINEAR",
    isActive: true,
  },
  trigify_profile_visit: {
    id: "reg-visit",
    code: "trigify_profile_visit",
    label: "Trigify — Profile visit",
    category: "INTENT",
    defaultPoints: 10,
    decayDays: 7,
    decayCurve: "STEP",
    isActive: true,
  },
  trigify_oxen_engagement_comment: {
    id: "reg-comment",
    code: "trigify_oxen_engagement_comment",
    label: "Trigify — Oxen engagement (comment)",
    category: "INTENT",
    defaultPoints: 10,
    decayDays: 30,
    decayCurve: "EXPONENTIAL",
    isActive: true,
  },
  trigify_intent_signal: {
    id: "reg-deprecated",
    code: "trigify_intent_signal",
    label: "Trigify intent signal (deprecated)",
    category: "INTENT",
    defaultPoints: 15,
    decayDays: 90,
    decayCurve: "LINEAR",
    isActive: false,
  },
}

function defaultRegistryStub(code: string) {
  return REGISTRY_ENTRIES[code] ?? null
}

// ── Test suite ──────────────────────────────────────────────────────
describe("POST /api/webhooks/trigify (Phase 2A)", () => {
  const ORIGINAL_SECRET = process.env.TRIGIFY_WEBHOOK_SECRET
  const ORIGINAL_BD_EMAILS = process.env.CRM_BD_EMAILS

  beforeAll(() => {
    process.env.TRIGIFY_WEBHOOK_SECRET = SECRET
    process.env.CRM_BD_EMAILS =
      "andy@oxen.finance,paullouis@oxen.finance,vernon@oxen.finance"
  })

  afterAll(() => {
    if (ORIGINAL_SECRET === undefined) {
      delete process.env.TRIGIFY_WEBHOOK_SECRET
    } else {
      process.env.TRIGIFY_WEBHOOK_SECRET = ORIGINAL_SECRET
    }
    if (ORIGINAL_BD_EMAILS === undefined) {
      delete process.env.CRM_BD_EMAILS
    } else {
      process.env.CRM_BD_EMAILS = ORIGINAL_BD_EMAILS
    }
  })

  beforeEach(() => {
    // resetAllMocks (not clearAllMocks) — clearAllMocks preserves
    // `mockResolvedValueOnce` queues across tests, which causes leftover
    // queued values from one test to bleed into the next. resetAllMocks
    // wipes the queue + implementation, so the defaults below are the
    // source of truth at the start of every test.
    vi.resetAllMocks()
    // Defaults: nothing in DB, registry resolves canonical codes.
    vi.mocked(prisma.crmContact.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.company.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.company.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.intentSignal.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.intentSignal.findMany).mockResolvedValue([] as never)
    // Cast the implementation through `as never` because Prisma's
    // findUnique return type is `PrismaPromise<X> & FluentApi<...>`
    // (with .intentSignals / .marketSignals chaining methods), not a
    // plain Promise. Our mock only needs to satisfy the awaited shape.
    vi.mocked(prisma.signalTypeRegistry.findUnique).mockImplementation(
      ((args: { where: { code: string } }) =>
        Promise.resolve(defaultRegistryStub(args.where.code))) as never,
    )
    // Auto-create defaults (used when no matching contact/company found).
    vi.mocked(prisma.company.create).mockResolvedValue({
      id: "co-new",
    } as never)
    vi.mocked(prisma.crmContact.create).mockResolvedValue({
      id: "ct-new",
      email: "auto@trigify.placeholder",
      firstName: "Auto",
      lastName: "Created",
      linkedinUrl: TRIGIFY_PAYLOAD_VALID.person_linkedin_url,
      companyId: null,
    } as never)
    vi.mocked(prisma.crmContact.update).mockResolvedValue({} as never)
    vi.mocked(prisma.intentSignal.create).mockResolvedValue({
      id: "sig-new",
    } as never)
    vi.mocked(telegram.notifyEmployee).mockResolvedValue(true)
  })

  // ─── [1] Authentication ────────────────────────────────────────────
  describe("[1] Authentication", () => {
    it("[1.1] returns 401 when secret header is missing", async () => {
      const res = await POST(makeReq(TRIGIFY_PAYLOAD_VALID, { secret: null }))
      expect(res.status).toBe(401)
    })

    it("[1.2] returns 401 when secret value is wrong", async () => {
      const res = await POST(
        makeReq(TRIGIFY_PAYLOAD_VALID, { secret: "wrong-secret" }),
      )
      expect(res.status).toBe(401)
    })

    it("[1.3] accepts request with correct secret", async () => {
      vi.mocked(prisma.crmContact.findFirst).mockResolvedValue({
        id: "ct-existing",
        email: "existing@example.com",
        firstName: "Existing",
        lastName: "User",
        linkedinUrl: TRIGIFY_PAYLOAD_VALID.person_linkedin_url,
        companyId: null,
      } as never)
      const res = await POST(makeReq(TRIGIFY_PAYLOAD_VALID))
      expect(res.status).toBe(200)
    })
  })

  // ─── [2] Zod validation ────────────────────────────────────────────
  describe("[2] Zod validation", () => {
    it("[2.1] returns 400 on invalid linkedinUrl (not a URL)", async () => {
      const res = await POST(
        makeReq({
          ...TRIGIFY_PAYLOAD_VALID,
          person_linkedin_url: "not-a-url",
        }),
      )
      expect(res.status).toBe(400)
    })

    it("[2.2] accepts full Phase 2A Trigify payload", async () => {
      vi.mocked(prisma.crmContact.findFirst).mockResolvedValue({
        id: "ct-1",
        email: "e@x.com",
        firstName: "E",
        lastName: "X",
        linkedinUrl: TRIGIFY_PAYLOAD_VALID.person_linkedin_url,
        companyId: null,
      } as never)
      const res = await POST(makeReq(TRIGIFY_PAYLOAD_VALID))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.ok).toBe(true)
    })

    it("[2.3] accepts legacy Sprint S1 payload (backward compat)", async () => {
      vi.mocked(prisma.crmContact.findFirst).mockResolvedValue({
        id: "ct-legacy",
        email: "legacy@example.com",
        firstName: "Legacy",
        lastName: "User",
        linkedinUrl: null,
        companyId: null,
      } as never)
      const res = await POST(makeReq(LEGACY_PAYLOAD_VALID))
      expect(res.status).toBe(200)
    })
  })

  // ─── [3] Matching by LinkedIn URL ──────────────────────────────────
  describe("[3] Matching: LinkedIn URL", () => {
    it("[3.1] matches contact by linkedinUrl (case-insensitive)", async () => {
      vi.mocked(prisma.crmContact.findFirst).mockResolvedValueOnce({
        id: "ct-by-linkedin",
        email: "e@x.com",
        firstName: "Jean-Philippe",
        lastName: "Chetcuti",
        linkedinUrl: TRIGIFY_PAYLOAD_VALID.person_linkedin_url,
        companyId: null,
      } as never)
      const res = await POST(makeReq(TRIGIFY_PAYLOAD_VALID))
      const body = await res.json()
      expect(body.contact_id).toBe("ct-by-linkedin")
      expect(body.match_method).toBe("linkedin_url")
    })

    it("[3.2] queries CrmContact.findFirst with insensitive mode on linkedinUrl", async () => {
      vi.mocked(prisma.crmContact.findFirst).mockResolvedValueOnce({
        id: "ct-1",
        email: "e@x.com",
        firstName: "X",
        lastName: "Y",
        linkedinUrl: TRIGIFY_PAYLOAD_VALID.person_linkedin_url,
        companyId: null,
      } as never)
      await POST(makeReq(TRIGIFY_PAYLOAD_VALID))
      const firstCall = vi.mocked(prisma.crmContact.findFirst).mock.calls[0]
      const arg = firstCall[0] as {
        where: { linkedinUrl: { equals: string; mode: string } }
      }
      expect(arg.where.linkedinUrl.equals).toBe(
        TRIGIFY_PAYLOAD_VALID.person_linkedin_url,
      )
      expect(arg.where.linkedinUrl.mode).toBe("insensitive")
    })
  })

  // ─── [4] Matching: email fallback ──────────────────────────────────
  describe("[4] Matching: email fallback", () => {
    it("[4.1] falls back to email when payload has no linkedinUrl (legacy)", async () => {
      // No linkedinUrl in payload → linkedin step is skipped → email step
      // runs. We return a hit on the first findFirst call (the email one).
      vi.mocked(prisma.crmContact.findFirst).mockResolvedValueOnce({
        id: "ct-by-email",
        email: "legacy@example.com",
        firstName: "Legacy",
        lastName: "User",
        linkedinUrl: null,
        companyId: null,
      } as never)
      const res = await POST(makeReq(LEGACY_PAYLOAD_VALID))
      const body = await res.json()
      expect(body.contact_id).toBe("ct-by-email")
      expect(body.match_method).toBe("email")
    })
  })

  // ─── [5] Matching: name+company fuzzy ──────────────────────────────
  describe("[5] Matching: name+company fuzzy", () => {
    it("[5.1] matches by firstName/lastName/company.name when linkedin+email miss", async () => {
      // Payload omits linkedinUrl and email → matchContact's linkedin
      // and email steps are skipped (no findFirst call). Only the
      // name+company step calls findFirst, so we queue one Once value.
      vi.mocked(prisma.crmContact.findFirst).mockResolvedValueOnce({
        id: "ct-fuzzy",
        email: "f@x.com",
        firstName: "Jean-Philippe",
        lastName: "Chetcuti",
        linkedinUrl: null,
        companyId: "co-1",
      } as never)
      const { person_linkedin_url: _omit, ...payload } = TRIGIFY_PAYLOAD_VALID
      void _omit
      const res = await POST(makeReq({ ...payload, company_name: "Inter-Serv" }))
      const body = await res.json()
      expect(body.match_method).toBe("name_company")
    })
  })

  // ─── [6] Auto-create ───────────────────────────────────────────────
  describe("[6] Auto-create", () => {
    it("[6.1] creates a new contact when no match found", async () => {
      // All findFirst lookups return null.
      vi.mocked(prisma.crmContact.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.company.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.crmContact.create).mockResolvedValueOnce({
        id: "ct-autocreated",
        email: "jpchetcuti@trigify.placeholder",
        firstName: "Jean-Philippe",
        lastName: "Chetcuti",
        linkedinUrl: TRIGIFY_PAYLOAD_VALID.person_linkedin_url,
        companyId: null,
      } as never)
      const res = await POST(makeReq(TRIGIFY_PAYLOAD_VALID))
      const body = await res.json()
      expect(body.match_method).toBe("auto_created")
      expect(body.contact_id).toBe("ct-autocreated")
      expect(prisma.crmContact.create).toHaveBeenCalled()
    })

    it("[6.2] creates a new company too when company_name is provided", async () => {
      vi.mocked(prisma.crmContact.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.company.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.company.create).mockResolvedValueOnce({
        id: "co-autocreated",
      } as never)
      vi.mocked(prisma.crmContact.create).mockResolvedValueOnce({
        id: "ct-auto-with-company",
        email: "e@trigify.placeholder",
        firstName: "X",
        lastName: "Y",
        linkedinUrl: null,
        companyId: "co-autocreated",
      } as never)
      const payload = { ...TRIGIFY_PAYLOAD_VALID, company_name: "NewCo Ltd" }
      await POST(makeReq(payload))
      expect(prisma.company.create).toHaveBeenCalled()
      const companyArgs = vi.mocked(prisma.company.create).mock.calls[0][0]
      expect((companyArgs as { data: { name: string } }).data.name).toBe(
        "NewCo Ltd",
      )
    })

    it("[6.3] synthesizes placeholder email from linkedinUrl slug on auto-create", async () => {
      vi.mocked(prisma.crmContact.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.company.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.crmContact.create).mockResolvedValueOnce({
        id: "ct-slug",
        email: "jpchetcuti@trigify.placeholder",
        firstName: "Jean-Philippe",
        lastName: "Chetcuti",
        linkedinUrl: TRIGIFY_PAYLOAD_VALID.person_linkedin_url,
        companyId: null,
      } as never)
      await POST(makeReq(TRIGIFY_PAYLOAD_VALID))
      const createArgs = vi.mocked(prisma.crmContact.create).mock.calls[0][0]
      const data = (createArgs as { data: { email: string } }).data
      expect(data.email).toBe("jpchetcuti@trigify.placeholder")
    })
  })

  // ─── [7] Idempotence / dedup ───────────────────────────────────────
  describe("[7] Dedup", () => {
    it("[7.1] returns duplicate_skipped when a same-day signal already exists", async () => {
      vi.mocked(prisma.crmContact.findFirst).mockResolvedValueOnce({
        id: "ct-1",
        email: "e@x.com",
        firstName: "X",
        lastName: "Y",
        linkedinUrl: TRIGIFY_PAYLOAD_VALID.person_linkedin_url,
        companyId: null,
      } as never)
      vi.mocked(prisma.intentSignal.findFirst).mockResolvedValueOnce({
        id: "sig-existing",
      } as never)
      const res = await POST(makeReq(TRIGIFY_PAYLOAD_VALID))
      const body = await res.json()
      expect(body.action).toBe("duplicate_skipped")
      expect(body.signal_id).toBe("sig-existing")
      expect(prisma.intentSignal.create).not.toHaveBeenCalled()
    })

    it("[7.2] creates a new signal when the day window has passed", async () => {
      vi.mocked(prisma.crmContact.findFirst).mockResolvedValueOnce({
        id: "ct-1",
        email: "e@x.com",
        firstName: "X",
        lastName: "Y",
        linkedinUrl: TRIGIFY_PAYLOAD_VALID.person_linkedin_url,
        companyId: null,
      } as never)
      // findExistingSignal returns null — no same-day duplicate.
      vi.mocked(prisma.intentSignal.findFirst).mockResolvedValueOnce(null)
      const res = await POST(makeReq(TRIGIFY_PAYLOAD_VALID))
      const body = await res.json()
      expect(body.action).toBe("ingested")
      expect(prisma.intentSignal.create).toHaveBeenCalled()
    })

    it("[7.3] does NOT send Telegram alert on duplicate_skipped", async () => {
      vi.mocked(prisma.crmContact.findFirst).mockResolvedValueOnce({
        id: "ct-hot",
        email: "e@x.com",
        firstName: "X",
        lastName: "Y",
        linkedinUrl: "https://www.linkedin.com/in/hot",
        companyId: null,
      } as never)
      vi.mocked(prisma.intentSignal.findFirst).mockResolvedValueOnce({
        id: "sig-existing",
      } as never)
      // Use a HOT signal type that would normally alert.
      const payload = { ...TRIGIFY_PAYLOAD_VALID, signal_type: "profile_visit" }
      await POST(makeReq(payload))
      expect(telegram.notifyEmployee).not.toHaveBeenCalled()
    })
  })

  // ─── [8] Signal type mapping ───────────────────────────────────────
  describe("[8] Signal type mapping", () => {
    it("[8.1] maps known signal_type to canonical SignalTypeRegistry code", async () => {
      vi.mocked(prisma.crmContact.findFirst).mockResolvedValueOnce({
        id: "ct-1",
        email: "e@x.com",
        firstName: "X",
        lastName: "Y",
        linkedinUrl: TRIGIFY_PAYLOAD_VALID.person_linkedin_url,
        companyId: null,
      } as never)
      const res = await POST(makeReq(TRIGIFY_PAYLOAD_VALID))
      const body = await res.json()
      expect(body.signal_code).toBe("trigify_competitor_engagement")
    })

    it("[8.2] unknown signal_type falls back to deprecated placeholder → registry_unavailable", async () => {
      vi.mocked(prisma.crmContact.findFirst).mockResolvedValueOnce({
        id: "ct-1",
        email: "e@x.com",
        firstName: "X",
        lastName: "Y",
        linkedinUrl: TRIGIFY_PAYLOAD_VALID.person_linkedin_url,
        companyId: null,
      } as never)
      const res = await POST(
        makeReq({ ...TRIGIFY_PAYLOAD_VALID, signal_type: "made_up_signal" }),
      )
      const body = await res.json()
      // The deprecated placeholder is isActive=false → route drops the signal.
      expect(body.action).toBe("registry_unavailable")
      expect(prisma.intentSignal.create).not.toHaveBeenCalled()
    })

    it("[8.3] missing signal_type also falls back to deprecated placeholder", async () => {
      vi.mocked(prisma.crmContact.findFirst).mockResolvedValueOnce({
        id: "ct-1",
        email: "e@x.com",
        firstName: "X",
        lastName: "Y",
        linkedinUrl: TRIGIFY_PAYLOAD_VALID.person_linkedin_url,
        companyId: null,
      } as never)
      const { signal_type: _omit, ...payload } = TRIGIFY_PAYLOAD_VALID
      void _omit
      const res = await POST(makeReq(payload))
      const body = await res.json()
      expect(body.action).toBe("registry_unavailable")
    })
  })

  // ─── [9] Telegram alerts ───────────────────────────────────────────
  describe("[9] Telegram alerts", () => {
    it("[9.1] broadcasts to all CRM_BD_EMAILS on profile_visit signal", async () => {
      vi.mocked(prisma.crmContact.findFirst).mockResolvedValueOnce({
        id: "ct-hot",
        email: "e@x.com",
        firstName: "X",
        lastName: "Y",
        linkedinUrl: "https://www.linkedin.com/in/hot",
        companyId: null,
      } as never)
      const payload = { ...TRIGIFY_PAYLOAD_VALID, signal_type: "profile_visit" }
      const res = await POST(makeReq(payload))
      const body = await res.json()
      expect(body.alerted).toBe(true)
      // 3 BDs in CRM_BD_EMAILS → 3 notifications.
      expect(telegram.notifyEmployee).toHaveBeenCalledTimes(3)
    })

    it("[9.2] broadcasts on oxen_engagement_comment signal", async () => {
      vi.mocked(prisma.crmContact.findFirst).mockResolvedValueOnce({
        id: "ct-1",
        email: "e@x.com",
        firstName: "X",
        lastName: "Y",
        linkedinUrl: TRIGIFY_PAYLOAD_VALID.person_linkedin_url,
        companyId: null,
      } as never)
      const payload = {
        ...TRIGIFY_PAYLOAD_VALID,
        signal_type: "oxen_engagement_comment",
      }
      await POST(makeReq(payload))
      expect(telegram.notifyEmployee).toHaveBeenCalledTimes(3)
    })

    it("[9.3] does NOT alert on competitor_engagement (not in immediate set)", async () => {
      vi.mocked(prisma.crmContact.findFirst).mockResolvedValueOnce({
        id: "ct-1",
        email: "e@x.com",
        firstName: "X",
        lastName: "Y",
        linkedinUrl: TRIGIFY_PAYLOAD_VALID.person_linkedin_url,
        companyId: null,
      } as never)
      const res = await POST(makeReq(TRIGIFY_PAYLOAD_VALID))
      const body = await res.json()
      expect(body.alerted).toBe(false)
      expect(telegram.notifyEmployee).not.toHaveBeenCalled()
    })

    it("[9.4] empty CRM_BD_EMAILS gracefully skips alerting", async () => {
      const original = process.env.CRM_BD_EMAILS
      process.env.CRM_BD_EMAILS = ""
      try {
        vi.mocked(prisma.crmContact.findFirst).mockResolvedValueOnce({
          id: "ct-hot",
          email: "e@x.com",
          firstName: "X",
          lastName: "Y",
          linkedinUrl: "https://www.linkedin.com/in/hot",
          companyId: null,
        } as never)
        const payload = {
          ...TRIGIFY_PAYLOAD_VALID,
          signal_type: "profile_visit",
        }
        const res = await POST(makeReq(payload))
        const body = await res.json()
        expect(body.alerted).toBe(false)
        expect(telegram.notifyEmployee).not.toHaveBeenCalled()
      } finally {
        process.env.CRM_BD_EMAILS = original
      }
    })
  })

  // ─── [10] IntentSignal persistence ─────────────────────────────────
  describe("[10] IntentSignal persistence", () => {
    it("[10.1] persists signal with correct contactId + signalTypeId", async () => {
      vi.mocked(prisma.crmContact.findFirst).mockResolvedValueOnce({
        id: "ct-x",
        email: "e@x.com",
        firstName: "X",
        lastName: "Y",
        linkedinUrl: TRIGIFY_PAYLOAD_VALID.person_linkedin_url,
        companyId: null,
      } as never)
      await POST(makeReq(TRIGIFY_PAYLOAD_VALID))
      const args = vi.mocked(prisma.intentSignal.create).mock.calls[0][0]
      const data = (
        args as {
          data: { contactId: string; signalTypeId: string; source: string }
        }
      ).data
      expect(data.contactId).toBe("ct-x")
      expect(data.signalTypeId).toBe("reg-comp")
      expect(data.source).toBe("trigify")
    })

    it("[10.2] uses payload.intent_score_points when provided (overrides registry default)", async () => {
      vi.mocked(prisma.crmContact.findFirst).mockResolvedValueOnce({
        id: "ct-x",
        email: "e@x.com",
        firstName: "X",
        lastName: "Y",
        linkedinUrl: TRIGIFY_PAYLOAD_VALID.person_linkedin_url,
        companyId: null,
      } as never)
      const payload = { ...TRIGIFY_PAYLOAD_VALID, intent_score_points: 42 }
      await POST(makeReq(payload))
      const args = vi.mocked(prisma.intentSignal.create).mock.calls[0][0]
      const data = (args as { data: { points: number } }).data
      expect(data.points).toBe(42)
    })

    it("[10.3] falls back to registry.defaultPoints when payload omits points", async () => {
      vi.mocked(prisma.crmContact.findFirst).mockResolvedValueOnce({
        id: "ct-x",
        email: "e@x.com",
        firstName: "X",
        lastName: "Y",
        linkedinUrl: TRIGIFY_PAYLOAD_VALID.person_linkedin_url,
        companyId: null,
      } as never)
      // TRIGIFY_PAYLOAD_VALID only has intent_score_points (Phase 2A
      // field name); the legacy `score` alias doesn't exist on it.
      const { intent_score_points: _omit, ...payload } = TRIGIFY_PAYLOAD_VALID
      void _omit
      await POST(makeReq(payload))
      const args = vi.mocked(prisma.intentSignal.create).mock.calls[0][0]
      const data = (args as { data: { points: number } }).data
      expect(data.points).toBe(6) // registry default for trigify_competitor_engagement
    })

    it("[10.4] persists rich metadata (signal_detail, post_url, raw_payload)", async () => {
      vi.mocked(prisma.crmContact.findFirst).mockResolvedValueOnce({
        id: "ct-x",
        email: "e@x.com",
        firstName: "X",
        lastName: "Y",
        linkedinUrl: TRIGIFY_PAYLOAD_VALID.person_linkedin_url,
        companyId: null,
      } as never)
      await POST(makeReq(TRIGIFY_PAYLOAD_VALID))
      const args = vi.mocked(prisma.intentSignal.create).mock.calls[0][0]
      // Cast through `unknown` because Prisma's `data.metadata` is
      // typed as `Exact<InputJsonValue | NullableJsonNullValueInput>`,
      // which has no structural overlap with our test-time concrete
      // shape. The `unknown` step satisfies TS's no-direct-conversion
      // rule for non-overlapping types.
      const data = (
        args as unknown as {
          data: {
            metadata: {
              signal_detail: string | null
              post_url: string | null
              raw_payload: Record<string, unknown>
            }
          }
        }
      ).data
      expect(data.metadata.signal_detail).toBe("Liked competitor post")
      expect(data.metadata.post_url).toBe(TRIGIFY_PAYLOAD_VALID.post_url)
      expect(data.metadata.raw_payload).toBeDefined()
    })
  })
})
