/**
 * Integration tests for /api/webhooks/lemlist.
 *
 * Scope (hotfix): the `emailsUnsubscribed` event was present in
 * `lemlistStatusMap` (→ "unsubscribed") but MISSING from `stageMap`, so an
 * unsubscribe flipped `lemlistStatus` while leaving `lifecycleStage`
 * untouched. This pins the fix (emailsUnsubscribed → "closed_lost") plus a
 * regression guard on an adjacent mapping.
 *
 * Mock strategy:
 * - @/lib/prisma : minimal mock of crmContact.findFirst/update + activity.create.
 *   We omit campaignName/campaignId from payloads so the OutreachCampaign sync
 *   branch is never entered (no need to mock outreachCampaign).
 * - @/lib/logger runs real (it only logs).
 *
 * Auth: the route reads LEMLIST_WEBHOOK_SECRET at module load time, so we set
 * it via vi.hoisted() BEFORE the import, then authenticate each request with
 * the static x-webhook-secret header (verifySignature's Method 2).
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

// ── Configure the webhook secret before the route module is imported ──
const { TEST_SECRET, ORIGINAL_SECRET } = vi.hoisted(() => {
  const ORIGINAL_SECRET = process.env.LEMLIST_WEBHOOK_SECRET
  const TEST_SECRET = "test-lemlist-secret-32bytes-deadbeef"
  process.env.LEMLIST_WEBHOOK_SECRET = TEST_SECRET
  return { TEST_SECRET, ORIGINAL_SECRET }
})

// ── Mocks before module-under-test imports ──────────────────────────
vi.mock("@/lib/prisma", () => ({
  prisma: {
    crmContact: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    activity: {
      create: vi.fn(),
    },
  },
}))

import { POST } from "./route"
import { prisma } from "@/lib/prisma"

// ── Helpers ─────────────────────────────────────────────────────────
function makeReq(body: unknown) {
  return new Request("http://localhost/api/webhooks/lemlist", {
    method: "POST",
    headers: new Headers({
      "Content-Type": "application/json",
      "x-webhook-secret": TEST_SECRET,
    }),
    body: JSON.stringify(body),
  })
}

type UpdateArgs = { where: { id: string }; data: Record<string, unknown> }

// ── Test suite ──────────────────────────────────────────────────────
describe("POST /api/webhooks/lemlist", () => {
  afterAll(() => {
    if (ORIGINAL_SECRET === undefined) {
      delete process.env.LEMLIST_WEBHOOK_SECRET
    } else {
      process.env.LEMLIST_WEBHOOK_SECRET = ORIGINAL_SECRET
    }
  })

  beforeEach(() => {
    vi.resetAllMocks()
    // Default: a known contact exists, mid-sequence fields absent so the
    // emailsSent step-increment branch never trips for these events.
    vi.mocked(prisma.crmContact.findFirst).mockResolvedValue({
      id: "ct-1",
      lemlistStep: null,
      lemlistTotalSteps: null,
      dealOwner: "Andy",
    } as never)
    vi.mocked(prisma.crmContact.update).mockResolvedValue({} as never)
    vi.mocked(prisma.activity.create).mockResolvedValue({} as never)
  })

  // ─── [1] emailsUnsubscribed → lifecycleStage flips to closed_lost ───
  it("[1] flips lifecycleStage to closed_lost on emailsUnsubscribed", async () => {
    const res = await POST(
      makeReq({ email: "unsub@example.com", event: "emailsUnsubscribed" }),
    )
    expect(res.status).toBe(200)

    expect(prisma.crmContact.update).toHaveBeenCalledTimes(1)
    const args = vi.mocked(prisma.crmContact.update).mock.calls[0][0] as UpdateArgs
    expect(args.where.id).toBe("ct-1")
    // The fix: stageMap now carries emailsUnsubscribed → closed_lost.
    expect(args.data.lifecycleStage).toBe("closed_lost")
    // Pre-existing behavior preserved: lemlistStatus still flips too.
    expect(args.data.lemlistStatus).toBe("unsubscribed")
  })

  // ─── [2] Regression guard: adjacent mapping unchanged ───────────────
  it("[2] still maps emailsBounced → sequence_active (adjacent entry intact)", async () => {
    const res = await POST(
      makeReq({ email: "bounce@example.com", event: "emailsBounced" }),
    )
    expect(res.status).toBe(200)

    const args = vi.mocked(prisma.crmContact.update).mock.calls[0][0] as UpdateArgs
    expect(args.data.lifecycleStage).toBe("sequence_active")
    expect(args.data.lemlistStatus).toBe("bounced")
  })
})
