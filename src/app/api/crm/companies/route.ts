import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"
import { validateBody, validateSearchParams } from "@/lib/validate"
import { createCompanySchema, listCompaniesQuery } from "../_schemas"

export async function GET(request: Request) {
  const { error } = await requirePageAccess("crm")
  if (error) return error

  const { searchParams } = new URL(request.url)
  const vq = validateSearchParams(searchParams, listCompaniesQuery)
  if ("error" in vq) return vq.error
  const { search, vertical, geoZone, industry, revenueRange } = vq.data
  const sortBy = vq.data.sortBy || "createdAt"
  const sortDir = vq.data.sortDir || "desc"

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

  const v = await validateBody(request, createCompanySchema)
  if ("error" in v) return v.error
  const {
    name, website, industry, description,
    hqCountry, hqCity, vertical, subVertical, geoZone,
    employeeCount, revenueRange, fundingTotal, techStack,
    linkedinUrl, socialProfiles,
  } = v.data

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
      employeeCount: employeeCount ?? null,
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
