import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const SEED_PAGES = [
  {
    title: "Welcome to Oxen OS",
    slug: "welcome-to-oxen-os",
    icon: "\uD83D\uDCCB",
    category: "General",
    pinned: true,
    order: 0,
    content: {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Welcome to Oxen OS" }] },
        { type: "paragraph", content: [{ type: "text", text: "Oxen OS is our internal operating system. This wiki serves as the single source of truth for all company knowledge, processes, and documentation." }] },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Getting Started" }] },
        { type: "bulletList", content: [
          { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Browse the sidebar to navigate between pages" }] }] },
          { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Use the search bar to find specific topics" }] }] },
          { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Click + New Page to create new documentation" }] }] },
          { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Pin important pages for quick access" }] }] },
        ]},
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Categories" }] },
        { type: "paragraph", content: [{ type: "text", text: "Pages are organized by category: Process, Legal, Product, HR, Finance, Compliance, and General. Use categories to keep knowledge structured." }] },
        { type: "blockquote", content: [{ type: "paragraph", content: [{ type: "text", text: "Tip: All changes are automatically saved and versioned. You can always restore a previous version from the version history panel." }] }] },
      ],
    },
  },
  {
    title: "Company Structure",
    slug: "company-structure",
    icon: "\uD83C\uDFDB",
    category: "Legal",
    pinned: false,
    order: 1,
    content: {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Company Structure" }] },
        { type: "paragraph", content: [{ type: "text", text: "Overview of the Oxen Group holding structure and legal entities." }] },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Entities" }] },
        { type: "bulletList", content: [
          { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", marks: [{ type: "bold" }], text: "Oxen Finance" }, { type: "text", text: " — Payment infrastructure and merchant services (Dubai, UAE)" }] }] },
          { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", marks: [{ type: "bold" }], text: "Escrowfy" }, { type: "text", text: " — Escrow and compliance services (Brussels, Belgium)" }] }] },
          { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", marks: [{ type: "bold" }], text: "Galaktika" }, { type: "text", text: " — Holding entity" }] }] },
          { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", marks: [{ type: "bold" }], text: "Lapki" }, { type: "text", text: " — Additional services entity" }] }] },
        ]},
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Governance" }] },
        { type: "paragraph", content: [{ type: "text", text: "The group operates under a decentralized model with entity-level autonomy and group-level strategic alignment. Board meetings are held quarterly." }] },
      ],
    },
  },
  {
    title: "Compliance Procedures",
    slug: "compliance-procedures",
    icon: "\uD83D\uDD12",
    category: "Compliance",
    pinned: false,
    order: 2,
    content: {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Compliance Procedures" }] },
        { type: "paragraph", content: [{ type: "text", text: "AML/KYC process documentation for all entities within the Oxen Group." }] },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "KYC Process" }] },
        { type: "orderedList", content: [
          { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Client submits onboarding form with required documentation" }] }] },
          { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Compliance team reviews documentation within 48 hours" }] }] },
          { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "PEP and sanctions screening via automated tools" }] }] },
          { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Risk assessment and classification (Low / Medium / High)" }] }] },
          { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Approval or escalation to senior compliance officer" }] }] },
        ]},
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "AML Monitoring" }] },
        { type: "paragraph", content: [{ type: "text", text: "Transaction monitoring is performed on a continuous basis. Suspicious activity reports (SARs) must be filed within 24 hours of detection." }] },
      ],
    },
  },
  {
    title: "Onboarding New Clients",
    slug: "onboarding-new-clients",
    icon: "\uD83D\uDE80",
    category: "Process",
    pinned: false,
    order: 3,
    content: {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Onboarding New Clients" }] },
        { type: "paragraph", content: [{ type: "text", text: "Step-by-step guide for onboarding new merchant clients to the Oxen payment platform." }] },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Pre-Onboarding" }] },
        { type: "bulletList", content: [
          { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Sales team confirms deal closure and obtains signed agreement" }] }] },
          { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "CRM deal moved to 'Won' stage" }] }] },
          { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Operations team notified via Slack" }] }] },
        ]},
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Technical Integration" }] },
        { type: "orderedList", content: [
          { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "API credentials generated and shared securely" }] }] },
          { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Test environment access provided" }] }] },
          { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Integration support call scheduled" }] }] },
          { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Go-live checklist completed" }] }] },
        ]},
      ],
    },
  },
  {
    title: "Tech Stack",
    slug: "tech-stack",
    icon: "\uD83D\uDCBB",
    category: "Product",
    pinned: false,
    order: 4,
    content: {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Tech Stack" }] },
        { type: "paragraph", content: [{ type: "text", text: "Overview of tools and infrastructure used across the Oxen Group." }] },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Internal Tools" }] },
        { type: "bulletList", content: [
          { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", marks: [{ type: "bold" }], text: "Oxen OS" }, { type: "text", text: " — Internal operating system (Next.js 16, Prisma, Railway)" }] }] },
          { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", marks: [{ type: "bold" }], text: "Database" }, { type: "text", text: " — PostgreSQL on Railway" }] }] },
          { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", marks: [{ type: "bold" }], text: "Auth" }, { type: "text", text: " — NextAuth v5 with Google OAuth" }] }] },
        ]},
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Communication" }] },
        { type: "bulletList", content: [
          { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Slack for internal messaging" }] }] },
          { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Google Workspace for email and calendar" }] }] },
          { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Telegram for quick external comms" }] }] },
        ]},
      ],
    },
  },
  {
    title: "HR Policies",
    slug: "hr-policies",
    icon: "\uD83D\uDC65",
    category: "HR",
    pinned: false,
    order: 5,
    content: {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "HR Policies" }] },
        { type: "paragraph", content: [{ type: "text", text: "Company policies for leave, expenses, and general HR matters." }] },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Leave Policy" }] },
        { type: "bulletList", content: [
          { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Annual leave: 25 working days per year" }] }] },
          { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Sick leave: up to 10 days paid per year" }] }] },
          { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Leave requests must be submitted 2 weeks in advance" }] }] },
        ]},
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Expense Policy" }] },
        { type: "bulletList", content: [
          { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Business expenses must be pre-approved by department head" }] }] },
          { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Receipts required for all claims over \u20AC50" }] }] },
          { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Reimbursement processed monthly" }] }] },
        ]},
      ],
    },
  },
]

export async function POST() {
  // Guard: never run in production
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Seed routes are disabled in production" },
      { status: 403 }
    )
  }

  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const existing = await prisma.wikiPage.count({ where: { archived: false } })
  if (existing > 0) {
    return NextResponse.json(
      { message: `Skipped: ${existing} wiki pages already exist.` },
      { status: 200 }
    )
  }

  const userId = session.user?.id ?? session.user?.email ?? "unknown"

  let created = 0
  for (const page of SEED_PAGES) {
    await prisma.wikiPage.create({
      data: {
        ...page,
        createdBy: userId,
        updatedBy: userId,
      },
    })
    created++
  }

  return NextResponse.json(
    { message: `Seeded ${created} wiki pages` },
    { status: 201 }
  )
}
