/**
 * Sprint 1.3 — Migration one-shot : chiffrement des tokens OAuth existants
 *
 * Ce script lit tous les comptes de la table Account et chiffre les champs
 * access_token, refresh_token, id_token s'ils ne le sont pas déjà.
 *
 * ⚠️ IMPORTANT : ce script utilise le client Prisma NON ÉTENDU pour bypasser
 * le chiffrement transparent. On veut manipuler les données au niveau brut
 * (lire en clair ce qui n'est pas chiffré, écrire le ciphertext directement).
 *
 * Usage :
 *   1. S'assurer que TOKEN_ENCRYPTION_KEY_V1 est défini dans l'env
 *   2. Lancer : npm run encrypt-tokens
 *   3. Vérifier le résumé affiché (encrypted, already-encrypted, skipped-null)
 *
 * Idempotent : peut être relancé. Les tokens déjà chiffrés sont détectés
 * via leur préfixe `enc:v1:` et skippés.
 */

import { PrismaClient } from "@prisma/client"
import { encrypt, isEncrypted } from "../src/lib/token-encryption"

const FIELDS = ["access_token", "refresh_token", "id_token"] as const

async function main() {
  // Client BRUT (sans extension) pour bypasser le chiffrement transparent
  const rawPrisma = new PrismaClient()

  console.log("[migration] Fetching all Account records...")
  const accounts = await rawPrisma.account.findMany({
    select: {
      id: true,
      userId: true,
      provider: true,
      access_token: true,
      refresh_token: true,
      id_token: true,
    },
  })

  console.log(`[migration] Found ${accounts.length} accounts.`)
  console.log("")

  const stats = {
    total: accounts.length,
    alreadyEncrypted: 0,
    nowEncrypted: 0,
    nullFields: 0,
    errors: 0,
  }

  // Transaction atomique : si une écriture échoue, aucune n'est commitée
  await rawPrisma.$transaction(async (tx) => {
    for (const account of accounts) {
      const updates: Record<string, string> = {}
      let needsUpdate = false

      for (const field of FIELDS) {
        const current = account[field]
        if (current === null || current === undefined) {
          stats.nullFields++
          continue
        }
        if (isEncrypted(current)) {
          stats.alreadyEncrypted++
          continue
        }
        try {
          updates[field] = encrypt(current)
          needsUpdate = true
          stats.nowEncrypted++
        } catch (err) {
          stats.errors++
          console.error(
            `[migration] ERROR encrypting ${field} for account ${account.id}:`,
            err instanceof Error ? err.message : err
          )
          throw err // Avort la transaction
        }
      }

      if (needsUpdate) {
        await tx.account.update({
          where: { id: account.id },
          data: updates,
        })
        console.log(
          `[migration] OK Account ${account.id} (provider=${account.provider}): ${Object.keys(updates).join(", ")}`
        )
      }
    }
  })

  console.log("")
  console.log("[migration] ==== SUMMARY ====")
  console.log(`[migration] Total accounts        : ${stats.total}`)
  console.log(`[migration] Now encrypted         : ${stats.nowEncrypted}`)
  console.log(`[migration] Already encrypted     : ${stats.alreadyEncrypted}`)
  console.log(`[migration] Null/undefined fields : ${stats.nullFields}`)
  console.log(`[migration] Errors                : ${stats.errors}`)

  await rawPrisma.$disconnect()

  if (stats.errors > 0) {
    console.error("[migration] Completed with errors — check logs above.")
    process.exit(1)
  }
  console.log("[migration] Done.")
}

main().catch((err) => {
  console.error("[migration] FATAL:", err)
  process.exit(1)
})
