import { PrismaClient, type Prisma } from "@prisma/client"
import { encryptNullable, decryptNullable } from "./token-encryption"
import { logger, serializeError } from "./logger"

/**
 * Prisma client singleton with transparent Account-token encryption.
 *
 * The `$extends` hook below encrypts `access_token`, `refresh_token`, and
 * `id_token` on every write, and decrypts them on every read. Application
 * code continues to read/write plaintext — encryption is invisible.
 *
 * Sprint 2.4a : slow-query logging wired via pino. Queries exceeding
 * `SLOW_QUERY_THRESHOLD_MS` (default 500ms) are logged at warn level with
 * the query text and params. Errors and warnings from Prisma are routed
 * through the structured logger as well.
 *
 * ⚠️ WORKER SYNC — This file is the canonical source and is mirrored to
 * `workers/sync-worker/src/lib/prisma.ts` via `npm run worker:sync-libs`.
 * DO NOT edit the worker copy directly. A SHA-256 hash test in
 * `src/lib/__tests__/worker-sync.test.ts` enforces identical content.
 */

const SLOW_QUERY_THRESHOLD_MS = Number(
  process.env.SLOW_QUERY_THRESHOLD_MS ?? 500
)

// Champs du modèle Account à chiffrer de façon transparente.
// ⚠️ Si vous ajoutez un champ ici, TOUT le code existant reste compatible,
// mais pensez à lancer le script scripts/encrypt-oauth-tokens.ts pour
// migrer les données existantes.
const ACCOUNT_ENCRYPTED_FIELDS = [
  "access_token",
  "refresh_token",
  "id_token",
] as const

function encryptAccountData<T extends Record<string, unknown>>(data: T): T {
  const out: Record<string, unknown> = { ...data }
  for (const field of ACCOUNT_ENCRYPTED_FIELDS) {
    if (field in out && typeof out[field] === "string") {
      out[field] = encryptNullable(out[field] as string)
    }
  }
  return out as T
}

function decryptAccountRecord<T extends Record<string, unknown> | null>(
  record: T
): T {
  if (!record) return record
  const out: Record<string, unknown> = { ...record }
  for (const field of ACCOUNT_ENCRYPTED_FIELDS) {
    if (field in out && typeof out[field] === "string") {
      try {
        out[field] = decryptNullable(out[field] as string)
      } catch (err) {
        // Fallback : si le déchiffrement échoue, on log mais on ne plante pas.
        // Cela peut arriver pendant la migration one-shot ou si un token
        // legacy non chiffré a échappé au script.
        logger.error(
          { err: serializeError(err), field },
          `prisma: failed to decrypt Account.${field}, returning raw value`
        )
      }
    }
  }
  return out as T
}

function makePrisma() {
  // Emit 'query' events to compute duration — only slow ones are logged.
  // 'error' and 'warn' events are routed through the structured logger.
  const base = new PrismaClient({
    log: [
      { level: "query", emit: "event" },
      { level: "error", emit: "event" },
      { level: "warn", emit: "event" },
    ],
  })

  base.$on("query" as never, (e: Prisma.QueryEvent) => {
    if (e.duration >= SLOW_QUERY_THRESHOLD_MS) {
      logger.warn(
        {
          prisma: {
            duration: e.duration,
            query: e.query,
            params: e.params,
          },
        },
        `slow query (${e.duration}ms)`
      )
    }
  })

  base.$on("error" as never, (e: Prisma.LogEvent) => {
    logger.error({ prisma: e }, "prisma error")
  })

  base.$on("warn" as never, (e: Prisma.LogEvent) => {
    logger.warn({ prisma: e }, "prisma warn")
  })

  return base.$extends({
    name: "account-token-encryption",
    query: {
      account: {
        // Chiffrement à l'écriture
        async create({ args, query }) {
          args.data = encryptAccountData(args.data as Record<string, unknown>) as typeof args.data
          const result = await query(args)
          return decryptAccountRecord(result as Record<string, unknown>)
        },
        async createMany({ args, query }) {
          if (Array.isArray(args.data)) {
            args.data = args.data.map((d) =>
              encryptAccountData(d as Record<string, unknown>)
            ) as typeof args.data
          } else {
            args.data = encryptAccountData(
              args.data as Record<string, unknown>
            ) as typeof args.data
          }
          return query(args)
        },
        async update({ args, query }) {
          args.data = encryptAccountData(args.data as Record<string, unknown>) as typeof args.data
          const result = await query(args)
          return decryptAccountRecord(result as Record<string, unknown>)
        },
        async updateMany({ args, query }) {
          args.data = encryptAccountData(args.data as Record<string, unknown>) as typeof args.data
          return query(args)
        },
        async upsert({ args, query }) {
          args.create = encryptAccountData(
            args.create as Record<string, unknown>
          ) as typeof args.create
          args.update = encryptAccountData(
            args.update as Record<string, unknown>
          ) as typeof args.update
          const result = await query(args)
          return decryptAccountRecord(result as Record<string, unknown>)
        },
        // Déchiffrement à la lecture
        async findUnique({ args, query }) {
          const result = await query(args)
          return decryptAccountRecord(result as Record<string, unknown> | null)
        },
        async findUniqueOrThrow({ args, query }) {
          const result = await query(args)
          return decryptAccountRecord(result as Record<string, unknown>)
        },
        async findFirst({ args, query }) {
          const result = await query(args)
          return decryptAccountRecord(result as Record<string, unknown> | null)
        },
        async findFirstOrThrow({ args, query }) {
          const result = await query(args)
          return decryptAccountRecord(result as Record<string, unknown>)
        },
        async findMany({ args, query }) {
          const results = await query(args)
          return (results as Array<Record<string, unknown>>).map((r) =>
            decryptAccountRecord(r)
          )
        },
      },
    },
  })
}

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof makePrisma> | undefined
}

export const prisma = globalForPrisma.prisma ?? makePrisma()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
