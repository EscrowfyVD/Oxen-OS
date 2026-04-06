import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"
import { getOwnerForGeo } from "@/lib/crm-config"

interface MappedContact {
  firstName: string
  lastName: string
  email: string
  phone?: string
  jobTitle?: string
  companyName?: string
  linkedinUrl?: string
  notes?: string
  vertical?: string[]
  subVertical?: string[]
  geoZone?: string
  dealOwner?: string
  lifecycleStage?: string
  acquisitionSource?: string
  acquisitionSourceDetail?: string
  outreachGroup?: string
  dealValue?: number
  contactType?: string
}

const ACTIVE_PIPELINE_STAGES = new Set([
  "qualified",
  "meeting_booked",
  "meeting_completed",
  "proposal_sent",
  "negotiation",
])

const BATCH_SIZE = 10

// POST /api/crm/contacts/import — bulk import contacts from parsed CSV data
export async function POST(request: Request) {
  const { error: pageErr, session } = await requirePageAccess("crm")
  if (pageErr) return pageErr

  try {
    const body = await request.json()
    const { contacts, duplicateAction } = body as {
      contacts: MappedContact[]
      duplicateAction: "skip" | "update"
    }

    if (!Array.isArray(contacts) || contacts.length === 0) {
      return NextResponse.json(
        { error: "contacts array is required and must not be empty" },
        { status: 400 },
      )
    }

    if (duplicateAction !== "skip" && duplicateAction !== "update") {
      return NextResponse.json(
        { error: 'duplicateAction must be "skip" or "update"' },
        { status: 400 },
      )
    }

    const userId = session.user?.email ?? "unknown"

    let importedCount = 0
    let updatedCount = 0
    let skippedCount = 0
    const errors: Array<{ email: string; reason: string }> = []

    // Process in batches
    for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
      const batch = contacts.slice(i, i + BATCH_SIZE)

      await prisma.$transaction(async (tx) => {
        for (const c of batch) {
          try {
            // Validate required fields
            if (!c.firstName || !c.lastName || !c.email) {
              errors.push({
                email: c.email || `row-${i + batch.indexOf(c) + 1}`,
                reason: "Missing required fields: firstName, lastName, email",
              })
              continue
            }

            const emailLower = c.email.toLowerCase()

            // 1. Duplicate check by email (case-insensitive)
            const existing = await tx.crmContact.findFirst({
              where: { email: { equals: emailLower, mode: "insensitive" } },
            })

            if (existing && duplicateAction === "skip") {
              skippedCount++
              continue
            }

            // 2. Company handling
            let companyId: string | null = null
            if (c.companyName) {
              const existingCompany = await tx.company.findFirst({
                where: { name: { equals: c.companyName, mode: "insensitive" } },
                select: { id: true },
              })

              if (existingCompany) {
                companyId = existingCompany.id
              } else {
                const newCompany = await tx.company.create({
                  data: { name: c.companyName },
                })
                companyId = newCompany.id
              }
            }

            // Resolve deal owner
            const resolvedDealOwner = c.dealOwner || getOwnerForGeo(c.geoZone)
            const resolvedLifecycleStage = c.lifecycleStage || "new_lead"
            const resolvedContactType = c.contactType || "prospect"

            if (existing && duplicateAction === "update") {
              // Merge non-empty fields (don't overwrite with empty values)
              const updateData: Record<string, unknown> = {}

              if (c.firstName) updateData.firstName = c.firstName
              if (c.lastName) updateData.lastName = c.lastName
              if (c.phone) updateData.phone = c.phone
              if (c.jobTitle) updateData.jobTitle = c.jobTitle
              if (companyId) updateData.companyId = companyId
              if (c.linkedinUrl) updateData.linkedinUrl = c.linkedinUrl
              if (c.vertical && c.vertical.length > 0) updateData.vertical = c.vertical
              if (c.subVertical && c.subVertical.length > 0) updateData.subVertical = c.subVertical
              if (c.geoZone) updateData.geoZone = c.geoZone
              if (c.dealOwner) updateData.dealOwner = c.dealOwner
              if (c.lifecycleStage) updateData.lifecycleStage = c.lifecycleStage
              if (c.acquisitionSource) updateData.acquisitionSource = c.acquisitionSource
              if (c.acquisitionSourceDetail) updateData.acquisitionSourceDetail = c.acquisitionSourceDetail
              if (c.outreachGroup) updateData.outreachGroup = c.outreachGroup
              if (c.contactType) updateData.contactType = c.contactType
              if (c.notes) updateData.pinnedNote = c.notes

              await tx.crmContact.update({
                where: { id: existing.id },
                data: updateData,
              })

              // Log activity for updated contact
              await tx.activity.create({
                data: {
                  type: "note_added",
                  description: "Imported from CSV",
                  contactId: existing.id,
                  performedBy: userId,
                },
              })

              updatedCount++
              continue
            }

            // 3. Create new CrmContact
            const contact = await tx.crmContact.create({
              data: {
                firstName: c.firstName,
                lastName: c.lastName,
                email: c.email,
                phone: c.phone ?? null,
                jobTitle: c.jobTitle ?? null,
                companyId,
                linkedinUrl: c.linkedinUrl ?? null,
                vertical: c.vertical ?? [],
                subVertical: c.subVertical ?? [],
                geoZone: c.geoZone ?? null,
                dealOwner: resolvedDealOwner,
                lifecycleStage: resolvedLifecycleStage,
                acquisitionSource: c.acquisitionSource ?? null,
                acquisitionSourceDetail: c.acquisitionSourceDetail ?? null,
                outreachGroup: c.outreachGroup ?? null,
                contactType: resolvedContactType,
                pinnedNote: c.notes ?? null,
                createdBy: userId,
              },
            })

            // 4. Create Deal if dealValue exists or lifecycle stage suggests active pipeline
            if (c.dealValue || ACTIVE_PIPELINE_STAGES.has(resolvedLifecycleStage)) {
              const dealName = c.companyName
                ? `${c.companyName} - Opportunity`
                : `${c.lastName} - Opportunity`

              await tx.deal.create({
                data: {
                  dealName,
                  contactId: contact.id,
                  companyId,
                  dealValue: c.dealValue ?? null,
                  stage: resolvedLifecycleStage,
                  dealOwner: resolvedDealOwner,
                  createdBy: userId,
                },
              })
            }

            // 5. Log Activity
            await tx.activity.create({
              data: {
                type: "note_added",
                description: "Imported from CSV",
                contactId: contact.id,
                performedBy: userId,
              },
            })

            importedCount++
          } catch (err) {
            const message = err instanceof Error ? err.message : "Unknown error"
            errors.push({
              email: c.email || `row-${i + batch.indexOf(c) + 1}`,
              reason: message,
            })
          }
        }
      })
    }

    return NextResponse.json({
      imported: importedCount,
      updated: updatedCount,
      skipped: skippedCount,
      errors,
    })
  } catch (err) {
    console.error("[CRM Contacts Import]", err)
    return NextResponse.json({ error: "Failed to import contacts" }, { status: 500 })
  }
}
