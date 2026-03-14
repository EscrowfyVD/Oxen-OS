import { prisma } from "@/lib/prisma"

/**
 * Log an activity event. Fire-and-forget — never throws.
 */
export function logActivity(
  action: string,
  detail: string,
  userId: string,
  entityId?: string,
  link?: string
) {
  prisma.activityLog
    .create({
      data: { action, detail, userId, entityId: entityId ?? null, link: link ?? null },
    })
    .catch((err) => {
      console.error("[ActivityLog] Failed to log:", err)
    })
}
