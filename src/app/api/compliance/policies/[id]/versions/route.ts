import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params

    const policy = await prisma.policy.findUnique({ where: { id } })
    if (!policy) return NextResponse.json({ error: "Policy not found" }, { status: 404 })

    const versions = await prisma.policyVersion.findMany({
      where: { policyId: id },
      orderBy: { version: "desc" },
    })

    return NextResponse.json({ versions })
  } catch (error) {
    console.error("[Policy Versions GET] Error:", error)
    return NextResponse.json({ error: "Failed to fetch policy versions" }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const body = await request.json()
    const { content, changelog } = body

    if (!content) {
      return NextResponse.json({ error: "content is required" }, { status: 400 })
    }

    const policy = await prisma.policy.findUnique({ where: { id } })
    if (!policy) return NextResponse.json({ error: "Policy not found" }, { status: 404 })

    const userId = session.user?.id ?? session.user?.email ?? "unknown"

    // Auto-increment version number
    const lastVersion = await prisma.policyVersion.findFirst({
      where: { policyId: id },
      orderBy: { version: "desc" },
    })
    const nextVersion = lastVersion ? lastVersion.version + 1 : 1

    const version = await prisma.policyVersion.create({
      data: {
        policyId: id,
        version: nextVersion,
        content,
        changelog: changelog || null,
        createdBy: userId,
      },
    })

    return NextResponse.json({ version }, { status: 201 })
  } catch (error) {
    console.error("[Policy Versions POST] Error:", error)
    return NextResponse.json({ error: "Failed to create policy version" }, { status: 500 })
  }
}
