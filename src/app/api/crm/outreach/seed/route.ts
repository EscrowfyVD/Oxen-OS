import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

interface SeedDomain {
  domain: string
  mailbox: string
  owner: string
}

const SEED_DOMAINS: SeedDomain[] = [
  { domain: "getoxen.com", mailbox: "andy@getoxen.com", owner: "Andy" },
  { domain: "oxengroup.com", mailbox: "andy@oxengroup.com", owner: "Andy" },
  { domain: "joinoxen.com", mailbox: "paullouis@joinoxen.com", owner: "Paul Louis" },
  { domain: "oxenpartners.com", mailbox: "paullouis@oxenpartners.com", owner: "Paul Louis" },
]

async function seed() {
  let seeded = 0

  for (const s of SEED_DOMAINS) {
    await prisma.outreachDomain.upsert({
      where: { domain: s.domain },
      update: {},
      create: {
        domain: s.domain,
        owner: s.owner,
        mailbox: s.mailbox,
        provider: "google_workspace",
        status: "warmup",
        warmupStartDate: new Date(),
        spfValid: false,
        dkimValid: false,
        dmarcValid: false,
      },
    })
    seeded++
  }

  return seeded
}

// GET + POST /api/crm/outreach/seed — seed initial domains (idempotent)
export async function GET() {
  try {
    const seeded = await seed()
    return NextResponse.json({ seeded })
  } catch (err) {
    console.error("[Outreach Seed]", err)
    return NextResponse.json({ error: "Failed to seed domains" }, { status: 500 })
  }
}

export async function POST() {
  try {
    const seeded = await seed()
    return NextResponse.json({ seeded })
  } catch (err) {
    console.error("[Outreach Seed]", err)
    return NextResponse.json({ error: "Failed to seed domains" }, { status: 500 })
  }
}
