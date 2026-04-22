import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"
import { validateBody } from "@/lib/validate"
import { createViewSchema } from "../_schemas"

export async function GET() {
  const { error, session } = await requirePageAccess("crm")
  if (error) return error

  const userEmail = session.user?.email ?? ""

  const views = await prisma.smartView.findMany({
    where: {
      OR: [
        { createdBy: userEmail },
        { isShared: true },
      ],
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json({ views })
}

export async function POST(request: Request) {
  const { error: pageErr, session } = await requirePageAccess("crm")
  if (pageErr) return pageErr

  const v = await validateBody(request, createViewSchema)
  if ("error" in v) return v.error
  const { name, filters, filterLogic, isShared } = v.data

  const view = await prisma.smartView.create({
    data: {
      name,
      filters,
      filterLogic: filterLogic ?? "and",
      isShared: isShared ?? false,
      createdBy: session.user?.email ?? "unknown",
    },
  })

  return NextResponse.json({ view }, { status: 201 })
}
