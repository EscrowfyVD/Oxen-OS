import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { JobType } from "./worker-config"

// ─── Create a new job ───
interface CreateJobOptions {
  type: JobType
  payload: Record<string, unknown>
  createdBy: string
  priority?: number
  maxAttempts?: number
}

export async function createJob(options: CreateJobOptions) {
  return prisma.job.create({
    data: {
      type: options.type,
      payload: options.payload as Prisma.InputJsonValue,
      createdBy: options.createdBy,
      priority: options.priority ?? 0,
      maxAttempts: options.maxAttempts ?? 3,
      status: "pending",
    },
  })
}

// ─── Claim the next pending job (atomic) ───
export async function claimJob(types: JobType[], workerId: string) {
  // Find and atomically claim the highest-priority pending job
  // Uses raw SQL for atomic update to avoid race conditions between workers
  const jobs = await prisma.$queryRaw<Array<{ id: string }>>`
    UPDATE "Job"
    SET "status" = 'processing',
        "processedBy" = ${workerId},
        "startedAt" = NOW(),
        "attempts" = "attempts" + 1,
        "updatedAt" = NOW()
    WHERE "id" = (
      SELECT "id" FROM "Job"
      WHERE "status" = 'pending'
        AND "type" = ANY(${types}::text[])
        AND "attempts" < "maxAttempts"
      ORDER BY "priority" DESC, "createdAt" ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING "id"
  `

  if (!jobs || jobs.length === 0) return null

  // Fetch the full job record
  return prisma.job.findUnique({ where: { id: jobs[0].id } })
}

// ─── Complete a job successfully ───
export async function completeJob(jobId: string, result: Record<string, unknown>) {
  return prisma.job.update({
    where: { id: jobId },
    data: {
      status: "completed",
      result: result as Prisma.InputJsonValue,
      completedAt: new Date(),
    },
  })
}

// ─── Fail a job — retries if under maxAttempts ───
export async function failJob(jobId: string, errorMessage: string) {
  const job = await prisma.job.findUnique({ where: { id: jobId } })
  if (!job) return null

  // If still under max attempts, reset to pending for retry
  const newStatus = job.attempts >= job.maxAttempts ? "failed" : "pending"

  return prisma.job.update({
    where: { id: jobId },
    data: {
      status: newStatus,
      error: errorMessage,
      processedBy: newStatus === "pending" ? null : job.processedBy,
      startedAt: newStatus === "pending" ? null : job.startedAt,
    },
  })
}

// ─── Get job status (for polling from frontend) ───
export async function getJobStatus(jobId: string) {
  return prisma.job.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      type: true,
      status: true,
      result: true,
      error: true,
      attempts: true,
      maxAttempts: true,
      createdAt: true,
      startedAt: true,
      completedAt: true,
    },
  })
}

// ─── Reset stale jobs (workers that crashed mid-processing) ───
export async function resetStaleJobs(timeoutMs: number) {
  const cutoff = new Date(Date.now() - timeoutMs)
  return prisma.job.updateMany({
    where: {
      status: "processing",
      startedAt: { lt: cutoff },
    },
    data: {
      status: "pending",
      processedBy: null,
      startedAt: null,
    },
  })
}

// ─── Clean up old completed/failed jobs ───
export async function cleanupOldJobs(olderThanDays: number = 30) {
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000)
  return prisma.job.deleteMany({
    where: {
      status: { in: ["completed", "failed"] },
      createdAt: { lt: cutoff },
    },
  })
}
