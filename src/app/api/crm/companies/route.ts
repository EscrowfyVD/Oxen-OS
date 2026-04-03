import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"

export async function GET(request: Request) {
  const { error } = await requirePageAccess("crm")
  if (error) return error

  const { searchParams } = new URL(request.url)
  const search = searchParams.get("search")
  const vertical = searchParams.get("vertical")
  const geoZone = searchParams.get("geoZone")
  const industry = searchParams.get("industry")
  const revenueRange = searchParams.get("revenueRange")
  const sortBy = searchParams.get("sortBy") || "createdAt"
  const sortDir = (searchParams.get("sortDir") || "desc") as "asc" | "desc"

  const where: Record<string, unknown> = {}

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { domain: { contains: search, mode: "insensitive" } },
      { industry: { contains: search, mode: "insensitive" } },
    ]
  }
  if (vertical && vertical !== "all") {
    where.vertical = { has: vertical }
  }
  if (geoZone && geoZone !== "all") {
    where.geoZone = geoZone
  }
  if (industry && industry !== "all") {
    where.industry = industry
  }
  if (revenueRange && revenueRange !== "all") {
    where.revenueRange = revenueRange
  }

  const companies = await prisma.company.findMany({
    where,
    include: {
      contacts: {
        select: { id: true, firstName: true, lastName: true, email: true, jobTitle: true },
        take: 5,
      },
      deals: {
        select: { id: true, dealName: true, stage: true, dealValue: true, weightedValue: true },
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
    orderBy: { [sortBy]: sortDir },
  })

  return NextResponse.json({ companies })
}

function extractDomain(website: string): string | null {
  try {
    let url = website.trim()
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`
    const parsed = new URL(url)
    return parsed.hostname.replace(/^www\./, "")
  } catch {
    return null
  }
}

export async function POST(request: Request) {
  const { error: pageErr, session } = await requirePageAccess("crm")
  if (pageErr) return pageErr

  const body = await request.json()
  const {
    name, website, industry, description,
    hqCountry, hqCity, vertical, subVertical, geoZone,
    employeeCount, revenueRange, fundingTotal, techStack,
    linkedinUrl, socialProfiles,
  } = body

  if (!name) {
    return NextResponse.json(
      { error: "Missing required field: name" },
      { status: 400 }
    )
  }

  // Auto-extract domain from website
  const domain = website ? extractDomain(website) : null

  // Check for duplicate domain
  if (domain) {
    const existing = await prisma.company.findUnique({ where: { domain } })
    if (existing) {
      return NextResponse.json(
        { error: `A company with domain "${domain}" already exists: ${existing.name}` },
        { status: 409 }
      )
    }
  }

  const userId = session.user?.email ?? "unknown"

  const company = await prisma.company.create({
    data: {
      name,
      website: website ?? null,
      domain: domain ?? null,
      industry: industry ?? null,
      description: description ?? null,
      hqCountry: hqCountry ?? null,
      hqCity: hqCity ?? null,
      vertical: vertical ?? [],
      subVertical: subVertical ?? [],
      geoZone: geoZone ?? null,
      employeeCount: employeeCount ? parseInt(employeeCount) : null,
      revenueRange: revenueRange ?? null,
      fundingTotal: fundingTotal ?? null,
      techStack: techStack ?? [],
      linkedinUrl: linkedinUrl ?? null,
      socialProfiles: socialProfiles ?? null,
    },
  })

  // Audit log
  await prisma.auditLog.create({
    data: {
      entityType: "company",
      entityId: company.id,
      action: "created",
      performedBy: userId,
    },
  })

  return NextResponse.json({ company }, { status: 201 })
}
