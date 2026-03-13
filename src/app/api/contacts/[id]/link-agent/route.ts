import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const { agentId } = await request.json()

  const contact = await prisma.contact.update({
    where: { id },
    data: {
      agentId: agentId || null,
      clientType: agentId ? "agent_referred" : "direct",
    },
  })

  return NextResponse.json({ contact })
}
