import { NextResponse } from "next/server"
import { CLAUDE_MODEL } from "@/lib/ai/model"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"
import Anthropic from "@anthropic-ai/sdk"
import { notifyLlmFailure, LlmOutputError } from "@/lib/ai/llm-alert"
import { parseLlmJson } from "@/lib/ai/parse-llm-json"

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const SYSTEM_PROMPT = `You are Sentinel, the regulatory compliance engine for Oxen Finance, a Swiss-regulated fintech company operating across multiple jurisdictions.

Analyze this marketing content for regulatory compliance. Check against ALL applicable rules for the specified jurisdictions.

RULES TO CHECK:

EU / MiCA:
- No misleading claims about crypto asset performance
- Risk warnings required for crypto-related promotions ("Crypto-assets are highly volatile and unregulated in most EU countries")
- No guaranteed returns language
- Clear identification as promotional material
- Issuer identification required

UK / FCA FinProm:
- Financial promotions must be fair, clear, and not misleading
- Must include appropriate risk warnings
- No claims of guaranteed returns
- Must identify the regulated entity (Escrowfy Ltd if applicable)
- Appropriate disclaimers for investment-related content
- S21 FSMA compliance check

UAE / CBUAE:
- No unauthorized financial promotion
- Compliance with VARA guidelines for virtual assets
- Arabic language requirements for UAE-targeted content (flag if missing)

Switzerland / FINMA:
- SRO compliance for payment service advertisements
- No misleading claims about regulatory status
- Proper entity identification

Malta / MFSA:
- VFA Act compliance for virtual financial asset promotions
- Proper licensing disclosures

General best practices:
- No absolute claims ("guaranteed", "risk-free", "100% safe")
- No comparison with traditional banking without disclaimers
- No client testimonials without disclaimers (where prohibited)
- Proper use of regulated entity names
- No misleading graphics or statistics
- Clear distinction between regulated and unregulated services
- Privacy compliance (no personal data in marketing without consent)
- Platform-specific rules (LinkedIn character limits, Instagram ad policies, etc.)

For each rule, return:
- rule: name of the regulation/rule
- status: "pass", "warning", or "fail"
- detail: specific finding in the content
- suggestion: how to fix if warning or fail

Also provide:
- overallRisk: "low", "medium", "high", or "critical"
- score: 0-100 compliance score
- summary: 2-3 sentence overall assessment with key actions needed

Return ONLY valid JSON: { "overallRisk": "...", "score": N, "summary": "...", "findings": [{"rule": "...", "status": "...", "detail": "...", "suggestion": "..."}] }`

export async function POST(request: Request) {
  const { error, session } = await requirePageAccess("marketing")
  if (error) return error

  try {
    const body = await request.json()
    const {
      contentIdeaId, platform, contentType, contentText,
      imageUrl, targetAudience, jurisdictions,
      sourceType, sourceFileName, sourceDriveId,
    } = body

    if (!platform || !contentType || !contentText) {
      return NextResponse.json({ error: "Platform, content type, and content text are required" }, { status: 400 })
    }

    // Create the check record as pending
    const check = await prisma.contentComplianceCheck.create({
      data: {
        contentIdeaId: contentIdeaId || null,
        platform,
        contentType,
        contentText,
        imageUrl: imageUrl || null,
        targetAudience: targetAudience || null,
        jurisdictions: jurisdictions || [],
        status: "checking",
        sourceType: sourceType || "text",
        sourceFileName: sourceFileName || null,
        sourceDriveId: sourceDriveId || null,
        createdBy: session?.user?.name || session?.user?.email || "unknown",
      },
    })

    // Build the user message for Claude
    const jurisdictionList = (jurisdictions || []).join(", ")
    const userMessage = `Please analyze this marketing content for regulatory compliance.

PLATFORM: ${platform}
CONTENT TYPE: ${contentType}
TARGET AUDIENCE: ${targetAudience || "General"}
JURISDICTIONS TO CHECK: ${jurisdictionList || "Global"}

CONTENT TO ANALYZE:
"""
${contentText}
"""
${imageUrl ? `\nIMAGE DESCRIPTION: ${imageUrl}` : ""}

Check against all applicable regulations for the specified jurisdictions and return the JSON result.`

    // Call Claude API
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    })

    // Parse the JSON verdict with the shared robust parser (truncation-aware; throws
    // on unusable output). Phase 0 RULE unchanged: an unusable verdict (unparseable OR
    // valid-but-incomplete) must NEVER be recorded as a real regulatory audit — no
    // fabricated medium/50/[]. The explicit 'error' state below is untouched.
    let result: { overallRisk?: string; score?: number; summary?: string; findings?: unknown[] } | null = null
    let parseError: unknown = null
    try {
      result = parseLlmJson<{ overallRisk?: string; score?: number; summary?: string; findings?: unknown[] }>(response)
    } catch (e) {
      parseError = e
    }

    if (
      parseError ||
      !result ||
      typeof result.overallRisk !== "string" ||
      result.overallRisk.length === 0 ||
      typeof result.score !== "number"
    ) {
      const err = parseError ?? new LlmOutputError("compliance verdict missing overallRisk/score")
      await notifyLlmFailure({
        source: "marketing/compliance-check",
        error: err,
        detail: "Compliance LLM output unusable — recorded as status:'error', NO verdict written.",
      })
      const errored = await prisma.contentComplianceCheck.update({
        where: { id: check.id },
        data: {
          status: "error",
          overallRisk: null,
          score: null,
          findings: [],
          summary:
            "LLM output could not be parsed into a complete verdict — this is NOT a completed audit. Re-run required.",
          checkedAt: new Date(),
        },
      })
      return NextResponse.json(
        { error: "Compliance check could not be evaluated — recorded as error, not a verdict", check: errored },
        { status: 502 },
      )
    }

    // Determine status based on risk
    let status = "approved"
    if (result.overallRisk === "critical" || result.overallRisk === "high") {
      status = "rejected"
    } else if (result.overallRisk === "medium") {
      status = "needs_changes"
    }

    // Update the check record with results
    const updated = await prisma.contentComplianceCheck.update({
      where: { id: check.id },
      data: {
        status,
        overallRisk: result.overallRisk || null,
        score: result.score ?? null,
        findings: (result.findings ?? []) as object[],
        summary: result.summary || null,
        checkedAt: new Date(),
      },
    })

    return NextResponse.json({ check: updated })
  } catch (err) {
    console.error("Compliance check failed:", err)
    return NextResponse.json({ error: "Compliance check failed" }, { status: 500 })
  }
}
