import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getJobStatus } from "@/lib/job-queue"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { jobId } = await params

  try {
    const job = await getJobStatus(jobId)
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 })
    }

    return NextResponse.json({ job })
  } catch (err) {
    console.error("[Job Status]", err)
    return NextResponse.json({ error: "Failed to get job status" }, { status: 500 })
  }
}
