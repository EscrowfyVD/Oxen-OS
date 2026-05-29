import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireWebhookSecret } from "@/lib/webhook-auth"
import { validateBody } from "@/lib/validate"
import { childLoggerFromRequest, serializeError } from "@/lib/logger"
import { n8nWebhookSchema } from "../_schemas"

export async function POST(request: Request) {
  const authFail = requireWebhookSecret(request, { envVarName: "N8N_WEBHOOK_SECRET" })
  if (authFail) return authFail

  const v = await validateBody(request, n8nWebhookSchema, { publicErrors: false })
  if ("error" in v) return v.error
  const { action, contactEmail, data } = v.data

  const log = childLoggerFromRequest(request).child({ webhook: "n8n", action })

  try {
    const body = v.data

    const contact = await prisma.crmContact.findFirst({
      where: { email: { equals: contactEmail, mode: "insensitive" } },
    })

    if (!contact) return NextResponse.json({ ok: true })

    switch (action) {
      case "create_signal": {
        // Sprint S1 — IntentSignal now requires a SignalTypeRegistry FK.
        // Upsert a placeholder entry by code ("n8n_external_signal")
        // with sensible defaults (10 points / 90-day linear decay /
        // INTENT) so this generic external-automation route can keep
        // ingesting without knowing about the canonical catalog.
        const registryEntry = await prisma.signalTypeRegistry.upsert({
          where: { code: "n8n_external_signal" },
          create: {
            code: "n8n_external_signal",
            label: "n8n external automation signal",
            description:
              "Placeholder for the generic /api/webhooks/n8n create_signal action — to be deprecated when each n8n workflow uses a canonical registry code.",
            defaultPoints: 10,
            decayDays: 90,
            decayCurve: "LINEAR",
            category: "INTENT",
          },
          update: {},
        })
        await prisma.intentSignal.create({
          data: {
            contactId: contact.id,
            companyId: contact.companyId,
            signalTypeId: registryEntry.id,
            source: "n8n",
            signalType: data?.signalType || "web_visit",
            title: data?.title || "n8n Signal",
            detail: data?.detail || null,
            points: data?.score ?? 10,
            expiresAt: data?.expiresAt ? new Date(data.expiresAt) : null,
            // Sprint 3a categorical axes — copied from the (placeholder)
            // registry. n8n_external_signal has intentCategory=null, so these
            // stay correctly excluded from the A-I Intent score until rewired
            // to canonical codes (sub-backlog).
            intentCategory: registryEntry.intentCategory,
            signalLevel: registryEntry.signalLevel,
            metadata: body,
          },
        })
        break
      }

      case "update_contact": {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updateData: any = {}
        const allowed = [
          "firstName", "lastName", "company", "vertical", "lifecycleStage", "source", "country",
          "outreachStatus", "leadSource", "clientType", "dealOwner", "introducerId",
        ] as const
        // Cast to indexable record — Zod narrows `data` to the discriminated
        // update_contact shape, which TypeScript rejects for generic string indexing.
        const d = data as Record<string, unknown> | undefined
        for (const key of allowed) {
          if (d?.[key] !== undefined) updateData[key] = d[key]
        }
        if (Object.keys(updateData).length > 0) {
          await prisma.crmContact.update({ where: { id: contact.id }, data: updateData })
        }
        break
      }

      case "create_interaction":
        await prisma.activity.create({
          data: {
            contactId: contact.id,
            type: data?.type || "note",
            description: data?.content || "n8n interaction",
            performedBy: "system",
          },
        })
        await prisma.crmContact.update({
          where: { id: contact.id },
          data: { lastInteraction: new Date() },
        })
        break
    }
  } catch (error) {
    log.error({ err: serializeError(error) }, "n8n webhook processing failed")
  }

  return NextResponse.json({ ok: true })
}
