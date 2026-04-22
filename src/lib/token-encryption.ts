import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Chiffrement symétrique des tokens OAuth stockés en base.
 *
 * Format versionné : enc:v1:<iv>:<ciphertext>:<authtag>
 * - v1 = AES-256-GCM avec IV 12 bytes
 * - Toutes les parties binaires encodées en base64url (sans padding `=`)
 *
 * Le versioning permet une rotation de clé future (v2, v3...) sans downtime :
 * le code de déchiffrement route sur la bonne clé selon le préfixe.
 *
 * ⚠️ WORKER SYNC — This file is the canonical source and is mirrored to
 * `workers/sync-worker/src/lib/token-encryption.ts` via
 * `npm run worker:sync-libs`. DO NOT edit the worker copy directly. Any
 * divergence causes silent encryption mismatches (tokens encrypted by one
 * side will fail to decrypt on the other). A SHA-256 hash test in
 * `src/lib/__tests__/worker-sync.test.ts` enforces identical content.
 */

const ALGO = "aes-256-gcm";
const IV_LENGTH = 12; // 12 bytes = recommandation NIST pour GCM
const AUTH_TAG_LENGTH = 16;
const VERSION_PREFIX = "enc:v1:";

/**
 * Charge la clé de chiffrement depuis l'environnement.
 * Fail-fast si absente ou invalide.
 */
function getKey(): Buffer {
  const raw = process.env.TOKEN_ENCRYPTION_KEY_V1;
  if (!raw) {
    throw new Error(
      "[token-encryption] TOKEN_ENCRYPTION_KEY_V1 is not defined. " +
        "Generate one with: openssl rand -base64 32"
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(
      `[token-encryption] TOKEN_ENCRYPTION_KEY_V1 must decode to 32 bytes ` +
        `(got ${key.length}). Generate with: openssl rand -base64 32`
    );
  }
  return key;
}

/**
 * Encode un Buffer en base64url (RFC 4648 §5, sans padding).
 * Plus safe pour DB/URL que base64 standard.
 */
function b64u(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function b64uDecode(s: string): Buffer {
  // Re-ajoute le padding manquant pour que Buffer.from l'accepte
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

/**
 * Chiffre une chaîne avec AES-256-GCM.
 * Retourne une chaîne formatée `enc:v1:<iv>:<ciphertext>:<authtag>`.
 *
 * Idempotent côté appelant : ne ré-chiffre PAS une string déjà chiffrée
 * (retourne la string telle quelle). Utile pour les migrations.
 */
export function encrypt(plaintext: string): string {
  if (isEncrypted(plaintext)) return plaintext;

  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, key, iv);

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return `${VERSION_PREFIX}${b64u(iv)}:${b64u(ciphertext)}:${b64u(authTag)}`;
}

/**
 * Déchiffre une chaîne au format `enc:v1:<iv>:<ciphertext>:<authtag>`.
 *
 * Si la chaîne n'est pas au format chiffré (ex: token legacy en clair),
 * elle est retournée telle quelle. Cela permet une migration progressive
 * ou un fallback gracieux si la clé n'est pas encore configurée partout.
 *
 * Throw en cas de format invalide ou auth tag incorrect (= tampering détecté).
 */
export function decrypt(ciphertext: string): string {
  if (!isEncrypted(ciphertext)) return ciphertext;

  const parts = ciphertext.slice(VERSION_PREFIX.length).split(":");
  if (parts.length !== 3) {
    throw new Error("[token-encryption] Invalid ciphertext format (v1)");
  }

  const [ivB64, ctB64, tagB64] = parts;
  const iv = b64uDecode(ivB64);
  const ct = b64uDecode(ctB64);
  const authTag = b64uDecode(tagB64);

  if (iv.length !== IV_LENGTH) {
    throw new Error(`[token-encryption] Invalid IV length: ${iv.length}`);
  }
  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error(
      `[token-encryption] Invalid auth tag length: ${authTag.length}`
    );
  }

  const key = getKey();
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(authTag);

  const plaintext = Buffer.concat([decipher.update(ct), decipher.final()]);
  return plaintext.toString("utf8");
}

/**
 * Détecte si une chaîne est au format chiffré (v1).
 * Utilisé pour l'idempotence et les fallbacks legacy.
 */
export function isEncrypted(s: string | null | undefined): s is string {
  return typeof s === "string" && s.startsWith(VERSION_PREFIX);
}

/**
 * Version null-safe : chiffre si non-null, sinon retourne null.
 * Pratique pour les champs Prisma optionnels (access_token?, etc.).
 */
export function encryptNullable(
  plaintext: string | null | undefined
): string | null {
  if (plaintext === null || plaintext === undefined) return null;
  return encrypt(plaintext);
}

/**
 * Version null-safe du déchiffrement.
 */
export function decryptNullable(
  ciphertext: string | null | undefined
): string | null {
  if (ciphertext === null || ciphertext === undefined) return null;
  return decrypt(ciphertext);
}
