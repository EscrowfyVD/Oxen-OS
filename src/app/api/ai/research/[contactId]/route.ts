import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Anthropic from "@anthropic-ai/sdk"

const anthropic = new Anthropic()

export async function POST(
  request: Request,
  { params }: { params: Promise<{ contactId: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { contactId } = await params

  const contact = await prisma.crmContact.findUnique({
    where: { id: contactId },
    include: { company: { select: { name: true } } },
  })
  if (!contact) return NextResponse.json({ error: "Contact not found" }, { status: 404 })

  try {
    const companyName = contact.company?.name || `${contact.firstName} ${contact.lastName}`
    const website = contact.website || ""

    const prompt = `Research the following company for a premium banking/payment infrastructure sales team. Return ONLY a valid JSON object.

COMPANY: ${companyName}
WEBSITE: ${website || "Not provided"}
VERTICAL: ${contact.vertical.join(", ") || "Not specified"}
CONTACT NAME: ${contact.firstName} ${contact.lastName}
COUNTRY: ${contact.country || "Not specified"}

Context: We are Oxen Finance, providing multi-currency accounts, SEPA/SWIFT payments, crypto-to-fiat exchange, card issuing, and compliance-first onboarding. Our target sectors are iGaming, crypto, family offices, and luxury asset brokers.

Return this JSON structure:
{
  "description": "2-3 paragraph description of the company, what they do, and their market position",
  "industry": "Primary industry/sector",
  "employeeCount": "Estimated employee count range (e.g. '50-200')",
  "revenue": "Estimated annual revenue range if known",
  "headquarters": "City, Country",
  "keyPeople": [
    {"name": "CEO Name", "title": "CEO", "linkedin": null, "email": null}
  ],
  "recentNews": [
    {"title": "News headline", "source": "Source", "date": "2024-01", "summary": "Brief summary", "sentiment": "positive|negative|neutral"}
  ],
  "ownership": {"type": "private|public|pe-backed", "details": "Any ownership details"},
  "relevanceToOxen": "How this company could benefit from Oxen's services",
  "competitiveLandscape": "Who are their current banking/payment providers, if known",
  "riskFactors": "Any compliance or reputational risks to be aware of"
}

Be as specific and accurate as possible. If you don't have information, indicate that clearly rather than guessing.`

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    })

    const responseText = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")

    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: "Failed to parse research" }, { status: 500 })
    }

    const research = JSON.parse(jsonMatch[0])

    // Upsert CompanyIntel
    const existing = await prisma.companyIntel.findFirst({ where: { contactId } })

    let intel
    if (existing) {
      intel = await prisma.companyIntel.update({
        where: { id: existing.id },
        data: {
          companyName,
          website: website || null,
          description: research.description || null,
          industry: research.industry || null,
          employeeCount: research.employeeCount || null,
          revenue: research.revenue || null,
          headquarters: research.headquarters || null,
          keyPeople: research.keyPeople || null,
          recentNews: research.recentNews || null,
          ownership: research.ownership || null,
          lastResearched: new Date(),
          dataSource: "claude",
        },
      })
    } else {
      intel = await prisma.companyIntel.create({
        data: {
          contactId,
          companyName,
          website: website || null,
          description: research.description || null,
          industry: research.industry || null,
          employeeCount: research.employeeCount || null,
          revenue: research.revenue || null,
          headquarters: research.headquarters || null,
          keyPeople: research.keyPeople || null,
          recentNews: research.recentNews || null,
          ownership: research.ownership || null,
          lastResearched: new Date(),
          dataSource: "claude",
        },
      })
    }

    return NextResponse.json({ intel, research })
  } catch (error) {
    console.error("Research error:", error)
    return NextResponse.json({ error: "Research failed" }, { status: 500 })
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ contactId: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { contactId } = await params

  const intel = await prisma.companyIntel.findFirst({
    where: { contactId },
    orderBy: { updatedAt: "desc" },
  })

  return NextResponse.json({ intel })
}
