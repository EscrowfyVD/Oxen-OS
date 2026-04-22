import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"
import { getOwnerForGeo } from "@/lib/crm-config"
import { enrollLead, getLemlistCampaigns, isLemlistConfigured } from "@/lib/lemlist"
import { validateBody, validateSearchParams } from "@/lib/validate"
import { createContactSchema, listContactsQuery } from "../_schemas"

// GET /api/crm/contacts — paginated list with filters
export async function GET(request: Request) {
  const { error } = await requirePageAccess("crm")
  if (error) return error

  const { searchParams } = new URL(request.url)
  const vq = validateSearchParams(searchParams, listContactsQuery)
  if ("error" in vq) return vq.error
  const { page, limit, lifecycleStage, vertical, geoZone, dealOwner, contactType, outreachGroup, lemlistCampaign, q } = vq.data
  const skip = (page - 1) * limit
  const sortBy = vq.data.sortBy || "createdAt"
  const sortDir = vq.data.sortDir || "desc"

  const where: Record<string, unknown> = {}

  if (lifecycleStage && lifecycleStage !== "all") {
    where.lifecycleStage = lifecycleStage
  }
  if (vertical && vertical !== "all") {
    where.vertical = { has: vertical }
  }
  if (geoZone && geoZone !== "all") {
    where.geoZone = geoZone
  }
  if (dealOwner && dealOwner !== "all") {
    where.dealOwner = dealOwner
  }
  if (contactType && contactType !== "all") {
    where.contactType = contactType
  }
  if (outreachGroup && outreachGroup !== "all") {
    where.outreachGroup = outreachGroup
  }
  if (lemlistCampaign && lemlistCampaign !== "all") {
    if (lemlistCampaign === "not_enrolled") {
      where.lemlistCampaignId = null
    } else if (lemlistCampaign === "completed") {
      where.lemlistStatus = "completed"
    } else {
      where.lemlistCampaignName = lemlistCampaign
    }
  }
  if (q) {
    where.OR = [
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { company: { name: { contains: q, mode: "insensitive" } } },
    ]
  }

  try {
    const [contacts, total] = await Promise.all([
      prisma.crmContact.findMany({
        where,
        include: {
          company: { select: { id: true, name: true, website: true } },
          activities: { orderBy: { createdAt: "desc" }, take: 1 },
        },
        orderBy: { [sortBy]: sortDir },
        skip,
        take: limit,
      }),
      prisma.crmContact.count({ where }),
    ])

    return NextResponse.json({
      contacts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (err) {
    console.error("[CRM Contacts GET]", err)
    return NextResponse.json({ error: "Failed to fetch contacts" }, { status: 500 })
  }
}

// POST /api/crm/contacts — create a new contact
export async function POST(request: Request) {
  const { error: pageErr, session } = await requirePageAccess("crm")
  if (pageErr) return pageErr

  try {
    const v = await validateBody(request, createContactSchema)
    if ("error" in v) return v.error
    const {
      firstName, lastName, email, phone, linkedinUrl, jobTitle,
      companyId, vertical, subVertical, geoZone,
      acquisitionSource, acquisitionSourceDetail,
      lifecycleStage, icpFit, contactType,
      companySize, fundingStage, techStack, annualRevenueRange,
      country, city, doNotContact, pinnedNote,
      telegram, whatsapp, website, introducerId,
      introducerVertical, introducerGeo,
      outreachGroup,
    } = v.data

    // Duplicate detection on email
    const existing = await prisma.crmContact.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json(
        { error: "A contact with this email already exists", existingId: existing.id },
        { status: 409 },
      )
    }

    // Auto-assign deal owner from geo zone
    const dealOwner = getOwnerForGeo(geoZone)
    const userId = session.user?.email ?? "unknown"

    const contact = await prisma.crmContact.create({
      data: {
        firstName,
        lastName,
        email,
        phone: phone ?? null,
        linkedinUrl: linkedinUrl ?? null,
        jobTitle: jobTitle ?? null,
        companyId: companyId ?? null,
        vertical: vertical ?? [],
        subVertical: subVertical ?? [],
        geoZone: geoZone ?? null,
        dealOwner,
        acquisitionSource: acquisitionSource ?? null,
        acquisitionSourceDetail: acquisitionSourceDetail ?? null,
        lifecycleStage: lifecycleStage ?? "new_lead",
        icpFit: icpFit ?? null,
        contactType: contactType ?? "prospect",
        companySize: companySize ?? null,
        fundingStage: fundingStage ?? null,
        techStack: techStack ?? [],
        annualRevenueRange: annualRevenueRange ?? null,
        country: country ?? null,
        city: city ?? null,
        doNotContact: doNotContact ?? false,
        pinnedNote: pinnedNote ?? null,
        telegram: telegram ?? null,
        whatsapp: whatsapp ?? null,
        website: website ?? null,
        introducerId: introducerId ?? null,
        introducerVertical: introducerVertical ?? [],
        introducerGeo: introducerGeo ?? null,
        outreachGroup: outreachGroup ?? null,
        createdBy: userId,
      },
      include: {
        company: { select: { id: true, name: true } },
      },
    })

    // Create AuditLog entry
    await prisma.auditLog.create({
      data: {
        entityType: "contact",
        entityId: contact.id,
        action: "created",
        newValue: `${firstName} ${lastName} (${email})`,
        performedBy: userId,
      },
    })

    // Auto-push to Lemlist: if outreachGroup is set and dealOwner is Andy or Paul Louis
    if (
      outreachGroup &&
      dealOwner &&
      ["Andy", "Paul Louis"].includes(dealOwner) &&
      !doNotContact &&
      isLemlistConfigured()
    ) {
      // Best-effort: find first matching campaign and enroll
      getLemlistCampaigns()
        .then(async (campaigns) => {
          if (campaigns.length > 0) {
            // Use the first available campaign
            const campaign = campaigns[0]
            const result = await enrollLead(campaign._id, {
              email,
              firstName,
              lastName,
              companyName: contact.company?.name ?? "",
            })
            if (result.ok) {
              await prisma.$transaction([
                prisma.activity.create({
                  data: {
                    type: "clay_sequence_event",
                    description: `Auto-enrolled in Lemlist sequence: ${campaign.name}`,
                    contactId: contact.id,
                    performedBy: "system",
                  },
                }),
                prisma.crmContact.update({
                  where: { id: contact.id },
                  data: { lifecycleStage: "sequence_active" },
                }),
              ])
            }
          }
        })
        .catch((err) =>
          console.error("[CRM POST] Lemlist auto-push error:", err),
        )
    }

    return NextResponse.json({ contact }, { status: 201 })
  } catch (err) {
    console.error("[CRM Contacts POST]", err)
    return NextResponse.json({ error: "Failed to create contact" }, { status: 500 })
  }
}
