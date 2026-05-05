import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// Mock Prisma BEFORE importing the module under test so the singleton
// import inside clay-enrichment resolves to our mock.
vi.mock("@/lib/prisma", () => ({
  prisma: {
    employee: {
      findMany: vi.fn(),
    },
  },
}))

import {
  classifyPersona,
  extractClayTableSegment,
  assignRandomBD,
} from "./clay-enrichment"
import { prisma } from "@/lib/prisma"

// ─────────────────────────────────────────────────────────────────────
describe("classifyPersona", () => {
  // DM keywords (D1): ceo, founder, owner, managing director, chief,
  //                   president, partner, director
  it("classifies CEO as DM", () => {
    expect(classifyPersona("CEO")).toBe("DM")
  })
  it("classifies Chief Executive Officer as DM", () => {
    expect(classifyPersona("Chief Executive Officer")).toBe("DM")
  })
  it("classifies Managing Director as DM", () => {
    expect(classifyPersona("Managing Director")).toBe("DM")
  })
  it("classifies plain Director as DM", () => {
    expect(classifyPersona("Director")).toBe("DM")
  })
  it("classifies Partner as DM", () => {
    expect(classifyPersona("Partner")).toBe("DM")
  })
  it("classifies VP Finance as OP (no DM keyword)", () => {
    expect(classifyPersona("VP Finance")).toBe("OP")
  })
  it("classifies Software Engineer as OP", () => {
    expect(classifyPersona("Software Engineer")).toBe("OP")
  })
  it("classifies Account Manager as OP", () => {
    expect(classifyPersona("Account Manager")).toBe("OP")
  })
  it("returns null for empty string", () => {
    expect(classifyPersona("")).toBeNull()
  })
  it("returns null for null input", () => {
    expect(classifyPersona(null)).toBeNull()
  })
  it("returns null for undefined input", () => {
    expect(classifyPersona(undefined)).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────
describe("extractClayTableSegment", () => {
  it("extracts segment from a Company table name", () => {
    expect(
      extractClayTableSegment("vDC_G1_Tier 1_Company_Active Business Loss"),
    ).toBe("Active Business Loss")
  })
  it("extracts segment from a People table name", () => {
    expect(
      extractClayTableSegment("vDC_G2_Tier 2_People_Crypto Funds Series A"),
    ).toBe("Crypto Funds Series A")
  })
  it("returns null when segment is empty", () => {
    // Trailing underscore with no content after — regex .+ requires ≥ 1 char
    expect(extractClayTableSegment("vDC_G1_Tier 1_Company_")).toBeNull()
  })
  it("returns null when table name does not match the pattern", () => {
    expect(extractClayTableSegment("invalid_table_name")).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────
describe("assignRandomBD", () => {
  const ORIGINAL_ENV = process.env.CRM_BD_EMAILS

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    if (ORIGINAL_ENV === undefined) {
      delete process.env.CRM_BD_EMAILS
    } else {
      process.env.CRM_BD_EMAILS = ORIGINAL_ENV
    }
  })

  it("returns one of the matched BD IDs (50/50 with 2 BDs)", async () => {
    process.env.CRM_BD_EMAILS = "andy@oxen.finance,paullouis@oxen.finance"
    vi.mocked(prisma.employee.findMany).mockResolvedValue([
      { id: "andy-id" },
      { id: "paul-id" },
    ] as never)

    const id = await assignRandomBD()
    expect(["andy-id", "paul-id"]).toContain(id)
    expect(prisma.employee.findMany).toHaveBeenCalledWith({
      where: {
        email: {
          in: ["andy@oxen.finance", "paullouis@oxen.finance"],
          mode: "insensitive",
        },
        isActive: true,
      },
      select: { id: true },
    })
  })

  it("returns null when no BD found in DB", async () => {
    process.env.CRM_BD_EMAILS = "andy@oxen.finance,paullouis@oxen.finance"
    vi.mocked(prisma.employee.findMany).mockResolvedValue([] as never)

    const id = await assignRandomBD()
    expect(id).toBeNull()
  })

  it("returns null when CRM_BD_EMAILS env var is unset", async () => {
    delete process.env.CRM_BD_EMAILS
    const id = await assignRandomBD()
    expect(id).toBeNull()
    // Should NOT call Prisma when no emails to match
    expect(prisma.employee.findMany).not.toHaveBeenCalled()
  })
})
