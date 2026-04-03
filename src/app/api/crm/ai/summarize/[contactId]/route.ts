import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Anthropic from "@anthropic-ai/sdk"

const anthropic = new Anthropic()

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ contactId: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { contactId } = await params

  try {
    const contact = await prisma.crmContact.findUnique({
      where: { id: contactId },
      include: {
        company: { select: { name: true } },
        activities: { orderBy: { createdAt: "desc" }, take: 5 },
        deals: { orderBy: { updatedAt: "desc" }, take: 5 },
      },
    })

    if (!contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 })
    }

    const prompt = `Generate a one-line summary (max 150 chars) of the current relationship status and latest context for this CRM contact. Be specific — mention dates, names, amounts, next steps where available.

**Contact:**
- Name: ${contact.firstName} ${contact.lastName}
- Company: ${contact.company?.name || "Unknown"}
- Lifecycle Stage: ${contact.lifecycleStage}
- Relationship: ${contact.relationshipStrength || "Unknown"}
- ICP Fit: ${contact.icpFit || "Not scored"}
- Pinned Note: ${contact.pinnedNote || "None"}

**Last 5 Activities:**
${contact.activities.map((a) => `- ${a.createdAt.toISOString().slice(0, 10)} | ${a.type}: ${(a.description || "").slice(0, 120)}`).join("\n") || "No activities"}

**Deals:**
${contact.deals.map((d) => `- ${d.dealName} | ${d.stage} | Value: ${d.dealValue ?? "N/A"}`).join("\n") || "No deals"}

Return ONLY the summary text, no quotes, no JSON, no explanation. Max 150 characters.`

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 256,
      messages: [{ role: "user", content: prompt }],
    })

    const text = response.content[0].type === "text" ? response.content[0].text : ""
    const summary = text.trim().slice(0, 150)

    await prisma.crmContact.update({
      where: { id: contactId },
      data: { aiSummary: summary },
    })

    return NextResponse.json({ contactId, summary })
  } catch (error) {
    console.error("[AI Summarize]", error)
    return NextResponse.json({ error: "Failed to generate summary" }, { status: 500 })
  }
}
