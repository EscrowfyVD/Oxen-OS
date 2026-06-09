// Apify scraped-signals webhook — D1 / PR1 (webhook MVP).
//
// Scope: receive → persist a Job → fast 200 → log. NO dataset fetch, NO enrich,
// NO scoring (the pipeline slice consumes the queued Jobs). Cloned from the
// LemCal webhook pattern.
//
// Auth: token-in-URL (?token=APIFY_WEBHOOK_SECRET). Apify DOES support a URL
// token on the webhook URL; the dataset re-fetch via APIFY_API_TOKEN (integrity
// check) belongs to the pipeline slice, not here.
//
// Payload: Apify's DEFAULT webhook body is
//   { eventType, resource: { defaultDatasetId, actId, status, ... } }
// — NOT { eventData: { actorId, defaultDatasetId } } (the PRD shape is wrong).
// We parse resource.defaultDatasetId + resource.actId from the default body.
//
// The [category] path suffix carries the signal category (e.g. "reddit-c",
// "news-d") because one actor can emit multiple categories — actorId alone
// can't key it.
//
// FAIL-CLOSED: never return 500 — a 5xx makes Apify retry-storm (and there is
// no retry after a 200). Bad/missing token → 401. Valid token + unusable body
// → 200 + logged (ignored).

import { NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { childLoggerFromRequest, serializeError } from "@/lib/logger"

const APIFY_WEBHOOK_SECRET = process.env.APIFY_WEBHOOK_SECRET || ""

export async function POST(
  request: Request,
  { params }: { params: Promise<{ category: string }> },
) {
  const { category } = await params
  const log = childLoggerFromRequest(request).child({ webhook: "apify", category })

  // 1. Token check (URL query) — the only barrier.
  const token = new URL(request.url).searchParams.get("token") ?? ""
  if (!APIFY_WEBHOOK_SECRET || token !== APIFY_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => null)
    const bodyObj = body && typeof body === "object" ? (body as Record<string, unknown>) : null

    // Apify default body → resource.{defaultDatasetId, actId}
    const resource =
      bodyObj && typeof bodyObj.resource === "object" && bodyObj.resource !== null
        ? (bodyObj.resource as Record<string, unknown>)
        : null
    const datasetId =
      resource && typeof resource.defaultDatasetId === "string"
        ? resource.defaultDatasetId
        : null
    const actId = resource && typeof resource.actId === "string" ? resource.actId : null

    if (!datasetId) {
      // Valid token but no dataset → ignore. NEVER 500 (no Apify retry storm).
      log.warn(
        { eventType: bodyObj?.eventType ?? null },
        "apify: no resource.defaultDatasetId — ignoring",
      )
      return NextResponse.json({ ok: true, action: "ignored_no_dataset" })
    }

    // 2. Persist a Job for the pipeline slice to consume. No fetch here.
    const job = await prisma.job.create({
      data: {
        type: "apify:process-dataset",
        payload: { datasetId, category, actId, raw: body } as Prisma.InputJsonValue,
        createdBy: "webhook:apify",
      },
      select: { id: true },
    })

    log.info({ jobId: job.id, datasetId, actId }, "apify: dataset job queued")
    return NextResponse.json({ ok: true, action: "queued", jobId: job.id, datasetId })
  } catch (error) {
    // Never 500 back to Apify (it retries on 5xx). The Job is the unit of work;
    // a transient failure here just means this delivery is dropped (Apify won't
    // retry after our 200, but the actor re-runs on schedule).
    log.error({ err: serializeError(error) }, "apify webhook processing failed")
    return NextResponse.json({ ok: true, action: "error" })
  }
}
