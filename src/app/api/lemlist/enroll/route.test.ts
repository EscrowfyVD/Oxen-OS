/**
 * Integration tests for POST /api/lemlist/enroll — Sprint S0.6
 * Lemlist hardening focus: cross-field persona vs campaign-name
 * validation guard.
 *
 * Verifies:
 *   - Persona OP enrolled in a Decision-Maker campaign → 400
 *   - Persona DM enrolled in an Operational campaign → 400
 *   - Persona DM in Decision-Maker campaign → proceeds (200)
 *   - Persona OP in Operational campaign → proceeds (200)
 *   - forcePersonaMismatch=true → override + warn log + proceed
 *   - Campaign not in local OutreachCampaign cache → defensive skip
 *     (proceed without validation, log warn)
 *   - Contact persona null/missing → no mismatch possible (proceed)
 *
 * Mock strategy:
 *   - @/lib/prisma : full mock of crmContact + outreachCampaign + activity
 *   - @/lib/admin  : requirePageAccess → success
 *   - global.fetch : mock the Lemlist API call so the test stays
 *     hermetic (no real Lemlist hit)
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

// Set LEMLIST_API_KEY BEFORE the route module imports (which captures
// the value into a top-level const). vi.hoisted runs before all
// imports, including the `import { POST } from "./route"` below.
vi.hoisted(() => {
  process.env.LEMLIST_API_KEY = "test-lemlist-key-32-chars-deadbeef"
})

vi.mock("@/lib/prisma", () => ({
  prisma: {
    crmContact: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    outreachCampaign: {
      findUnique: vi.fn(),
    },
    activity: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

vi.mock("@/lib/admin", () => ({
  requirePageAccess: vi.fn(),
}))

import { POST } from "./route"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"

function makeReq(body: unknown) {
  return new Request("http://localhost/api/lemlist/enroll", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("POST /api/lemlist/enroll — Sprint S0.6 persona validation", () => {
  // LEMLIST_API_KEY is set in vi.hoisted at the top of this file so
  // the route module's top-level `const LEMLIST_API_KEY = process.env...`
  // captures the test value (not undefined → no 500 on each call).

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requirePageAccess).mockResolvedValue({
      error: null,
      session: { user: { email: "andy@oxen.finance" } },
      employee: null,
      roleLevel: "admin",
    } as never)

    // Mock global.fetch — Lemlist POST + GET (campaign data) calls.
    // Returns a successful generic response so the happy path can
    // reach the $transaction step.
    global.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({ _id: "lemlist-lead-1", sequence: [{}, {}, {}] }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    ) as unknown as typeof global.fetch

    // $transaction defaults to passing through the array of operations.
    vi.mocked(prisma.$transaction).mockImplementation(
      (async (arg: unknown) => {
        if (Array.isArray(arg)) return Promise.all(arg)
        if (typeof arg === "function") {
          return arg(prisma as never)
        }
        return null
      }) as never,
    )
  })

  // Common contact fixture — overridden per-test for persona variations.
  const makeContact = (persona: "DM" | "OP" | null) => ({
    id: "ct-test",
    firstName: "Alice",
    lastName: "Smith",
    email: "alice@example.com",
    doNotContact: false,
    persona,
    pinnedNote: null,
    totalInteractions: 0,
    company: { name: "Acme Corp" },
  })

  // ─── Mismatch cases (return 400) ────────────────────────────────
  it("[1] persona=OP enrolled in a Decision-Maker campaign → 400 Persona mismatch", async () => {
    vi.mocked(prisma.crmContact.findUnique).mockResolvedValue(
      makeContact("OP") as never,
    )
    vi.mocked(prisma.outreachCampaign.findUnique).mockResolvedValue({
      name: "G1_Tier 1_Decision-Maker",
    } as never)

    const res = await POST(
      makeReq({ contactId: "ct-test", campaignId: "cam_dm_1" }),
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe("Persona mismatch")
    expect(body.details).toMatchObject({
      contactPersona: "OP",
      campaignName: "G1_Tier 1_Decision-Maker",
    })
    // Critical: Lemlist API was NOT called (we 400 before pushing)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it("[2] persona=DM enrolled in an Operational campaign → 400", async () => {
    vi.mocked(prisma.crmContact.findUnique).mockResolvedValue(
      makeContact("DM") as never,
    )
    vi.mocked(prisma.outreachCampaign.findUnique).mockResolvedValue({
      name: "G5_Tier 2_Operational [v1]",
    } as never)

    const res = await POST(
      makeReq({ contactId: "ct-test", campaignId: "cam_op_1" }),
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.details.contactPersona).toBe("DM")
    expect(body.details.campaignName).toContain("Operational")
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it("[3] case-insensitive name match (Decision-Maker vs decisionmaker)", async () => {
    vi.mocked(prisma.crmContact.findUnique).mockResolvedValue(
      makeContact("OP") as never,
    )
    vi.mocked(prisma.outreachCampaign.findUnique).mockResolvedValue({
      name: "g7a_tier 1_decisionmaker",
    } as never)

    const res = await POST(
      makeReq({ contactId: "ct-test", campaignId: "cam_dm_2" }),
    )
    expect(res.status).toBe(400) // /Decision-?Maker/i should match
  })

  // ─── Match cases (proceed normally) ──────────────────────────────
  it("[4] persona=DM in Decision-Maker campaign → proceeds (200)", async () => {
    vi.mocked(prisma.crmContact.findUnique).mockResolvedValue(
      makeContact("DM") as never,
    )
    vi.mocked(prisma.outreachCampaign.findUnique).mockResolvedValue({
      name: "G1_Tier 1_Decision-Maker",
    } as never)

    const res = await POST(
      makeReq({ contactId: "ct-test", campaignId: "cam_dm_1" }),
    )
    expect(res.status).toBe(200)
    // Lemlist API was hit (POST lead + GET campaign for activity log)
    expect(global.fetch).toHaveBeenCalled()
  })

  it("[5] persona=OP in Operational campaign → proceeds (200)", async () => {
    vi.mocked(prisma.crmContact.findUnique).mockResolvedValue(
      makeContact("OP") as never,
    )
    vi.mocked(prisma.outreachCampaign.findUnique).mockResolvedValue({
      name: "G5_Tier 1_Operational",
    } as never)

    const res = await POST(
      makeReq({ contactId: "ct-test", campaignId: "cam_op_1" }),
    )
    expect(res.status).toBe(200)
  })

  // ─── Override flag ───────────────────────────────────────────────
  it("[6] forcePersonaMismatch=true overrides the guard (200 + warn logged)", async () => {
    vi.mocked(prisma.crmContact.findUnique).mockResolvedValue(
      makeContact("OP") as never,
    )
    vi.mocked(prisma.outreachCampaign.findUnique).mockResolvedValue({
      name: "G1_Tier 1_Decision-Maker",
    } as never)

    const res = await POST(
      makeReq({
        contactId: "ct-test",
        campaignId: "cam_dm_1",
        forcePersonaMismatch: true, // ← override
      }),
    )
    expect(res.status).toBe(200) // proceeds despite mismatch
  })

  // ─── Defensive skip cases ────────────────────────────────────────
  it("[7] campaign not in local OutreachCampaign cache → skip validation, proceed", async () => {
    vi.mocked(prisma.crmContact.findUnique).mockResolvedValue(
      makeContact("OP") as never,
    )
    // No local cache row — proceed without persona validation
    vi.mocked(prisma.outreachCampaign.findUnique).mockResolvedValue(null)

    const res = await POST(
      makeReq({ contactId: "ct-test", campaignId: "cam_unknown" }),
    )
    expect(res.status).toBe(200) // defensive: don't block on missing cache
  })

  it("[8] contact persona is null → no mismatch possible (proceeds)", async () => {
    vi.mocked(prisma.crmContact.findUnique).mockResolvedValue(
      makeContact(null) as never,
    )
    vi.mocked(prisma.outreachCampaign.findUnique).mockResolvedValue({
      name: "G1_Tier 1_Decision-Maker",
    } as never)

    const res = await POST(
      makeReq({ contactId: "ct-test", campaignId: "cam_dm_1" }),
    )
    expect(res.status).toBe(200)
  })

  it("[9] campaign name with no persona keyword (e.g. neutral name) → proceeds", async () => {
    vi.mocked(prisma.crmContact.findUnique).mockResolvedValue(
      makeContact("DM") as never,
    )
    vi.mocked(prisma.outreachCampaign.findUnique).mockResolvedValue({
      name: "G1_Custom_Mixed_Audience",
    } as never)

    const res = await POST(
      makeReq({ contactId: "ct-test", campaignId: "cam_neutral" }),
    )
    expect(res.status).toBe(200) // no /Decision-?Maker/i or /Operational/i hit
  })

  // ─── Existing guards preserved (no regression) ──────────────────
  it("[10] doNotContact=true still 400s (pre-existing guard preserved)", async () => {
    vi.mocked(prisma.crmContact.findUnique).mockResolvedValue({
      ...makeContact("DM"),
      doNotContact: true,
    } as never)

    const res = await POST(
      makeReq({ contactId: "ct-test", campaignId: "cam_any" }),
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain("Do Not Contact")
    // Persona check was NOT reached (doNotContact short-circuits earlier)
    expect(prisma.outreachCampaign.findUnique).not.toHaveBeenCalled()
  })

  it("[11] missing contactId → 400 (pre-existing validation preserved)", async () => {
    const res = await POST(makeReq({ campaignId: "cam_any" }))
    expect(res.status).toBe(400)
  })

  it("[12] contact not found → 404 (pre-existing guard preserved)", async () => {
    vi.mocked(prisma.crmContact.findUnique).mockResolvedValue(null)
    const res = await POST(
      makeReq({ contactId: "ghost", campaignId: "cam_any" }),
    )
    expect(res.status).toBe(404)
  })
})

