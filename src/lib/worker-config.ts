/**
 * Worker Architecture Configuration
 * Feature flag: ENABLE_WORKERS controls whether jobs are queued for workers
 * or processed inline (current behavior).
 */

// Feature flag — when false, all processing happens inline in API routes (current behavior)
// When true, heavy work is queued as Jobs for the AI/Sync workers
export const ENABLE_WORKERS = process.env.ENABLE_WORKERS === "true"

// Job type constants
export const JOB_TYPES = {
  // AI Worker handles these
  AI_SCORE_LEAD: "ai:score-lead",
  AI_GENERATE_ARTICLE: "ai:generate-article",
  AI_NEWS_SCAN: "ai:news-scan",
  AI_KEYWORD_DISCOVER: "ai:keyword-discover",
  AI_GEO_TEST: "ai:geo-test",
  AI_SCORE_NEWS: "ai:score-news",
  // Sync Worker handles these
  SYNC_EMAIL: "sync:email",
  SYNC_CALENDAR: "sync:calendar",
} as const

export type JobType = (typeof JOB_TYPES)[keyof typeof JOB_TYPES]

// Which job types each worker processes
export const AI_WORKER_TYPES: JobType[] = [
  JOB_TYPES.AI_SCORE_LEAD,
  JOB_TYPES.AI_GENERATE_ARTICLE,
  JOB_TYPES.AI_NEWS_SCAN,
  JOB_TYPES.AI_KEYWORD_DISCOVER,
  JOB_TYPES.AI_GEO_TEST,
  JOB_TYPES.AI_SCORE_NEWS,
]

export const SYNC_WORKER_TYPES: JobType[] = [
  JOB_TYPES.SYNC_EMAIL,
  JOB_TYPES.SYNC_CALENDAR,
]

// Worker polling and retry config
export const WORKER_CONFIG = {
  AI_POLL_INTERVAL_MS: 5000,     // 5 seconds
  SYNC_POLL_INTERVAL_MS: 10000,  // 10 seconds
  MAX_RETRIES: 3,
  STALE_JOB_TIMEOUT_MS: 300000,  // 5 minutes — reset jobs stuck in "processing"
  HEARTBEAT_INTERVAL_MS: 30000,  // 30 seconds
}
