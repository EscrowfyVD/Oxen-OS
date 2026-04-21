# Sprint 0 — Critical Hotfixes Report

**Date:** 2026-04-21
**Author:** Claude (code review agent)
**Scope:** 5 audit items → 3 fixes, 10 files touched, 1 file created

---

## Fix #1 — Seed Routes Hardened (Audit #C4)

| Item | Status |
|---|---|
| Removed 3 seed whitelists from `src/middleware.ts` | ✅ |
| Added NODE_ENV guard to `src/app/api/crm/outreach/seed/route.ts` (GET + POST) | ✅ |
| Added NODE_ENV guard to `src/app/api/seo/seed/route.ts` (GET + POST) | ✅ |
| Added NODE_ENV guard to `src/app/api/wiki/seed/route.ts` (POST) | ✅ |

**Behavior change:** Seed routes now require NextAuth authentication (middleware no longer whitelists them). In production (`NODE_ENV === "production"`), they return `403 Forbidden` regardless of auth.

**Grep verification:**
```
grep -n 'seed' src/middleware.ts → 0 matches ✅
```

---

## Fix #2 — NextAuth Debug Disabled in Prod (Audit #C5)

| Item | Status |
|---|---|
| `src/lib/auth.ts` line 129: `debug: true` → `debug: process.env.NODE_ENV !== "production"` | ✅ |

**Behavior change:** NextAuth no longer logs session tokens, OAuth codes, and callback URLs in production. Debug logging remains active in development for troubleshooting.

**Grep verification:**
```
grep -n 'debug: true' src/lib/auth.ts → 0 matches ✅
```

---

## Fix #3 — Webhook Auth Hardened (Audit #C1, #C2, #C3)

| Item | Status |
|---|---|
| Created `src/lib/webhook-auth.ts` with `requireWebhookSecret()` | ✅ |
| Applied to `src/app/api/webhooks/clay/route.ts` | ✅ |
| Applied to `src/app/api/webhooks/trigify/route.ts` | ✅ |
| Applied to `src/app/api/webhooks/n8n/route.ts` | ✅ |
| Added fail-closed guard to `src/app/api/webhooks/lemlist/route.ts` | ✅ |

**Old pattern (Clay, Trigify, N8N):**
```ts
if (process.env.XXX_WEBHOOK_SECRET && secret !== process.env.XXX_WEBHOOK_SECRET) {
  return NextResponse.json({ ok: true })  // ← silent pass-through on missing env var
}
```

**New pattern (Clay, Trigify, N8N):**
```ts
const authFail = requireWebhookSecret(request, { envVarName: "XXX_WEBHOOK_SECRET" })
if (authFail) return authFail  // ← 401 if missing/invalid, throws if env var undefined
```

**Lemlist:** Added handler-level fail-closed guard. If `LEMLIST_WEBHOOK_SECRET` is not defined, returns `500` instead of silently accepting all requests. HMAC verification logic untouched.

**Note on Lemlist implementation:** The spec requested a module-scope `throw`, but Next.js evaluates route modules during build (`collecting page data`), causing a build failure when the env var is absent locally. The guard was moved to the top of the POST handler to achieve the same fail-closed behavior at request-time without breaking the build pipeline.

**`requireWebhookSecret()` features:**
- Uses `crypto.timingSafeEqual` for constant-time comparison (prevents timing attacks)
- Throws `Error` if env var is not defined (fail-closed)
- Returns `401` if header is missing or invalid
- Returns `null` if authentic (caller proceeds)

**Grep verification:**
```
grep -rn 'process.env.*WEBHOOK_SECRET && secret !==' src/app/api/webhooks/ → 0 matches ✅
```

---

## Build Verification

| Check | Result |
|---|---|
| `npx tsc --noEmit` | ✅ Zero errors |
| `npx next build` | ✅ Compiled successfully, 185/185 static pages |

---

## Files Changed

```
 src/middleware.ts                          |  3 ---  (removed seed whitelists)
 src/app/api/crm/outreach/seed/route.ts    | 16 ++++  (NODE_ENV guard × 2)
 src/app/api/seo/seed/route.ts             | 16 ++++  (NODE_ENV guard × 2)
 src/app/api/wiki/seed/route.ts            |  8 +++  (NODE_ENV guard × 1)
 src/lib/auth.ts                           |  2 +-   (debug conditional)
 src/lib/webhook-auth.ts                   | 42 ++++  (NEW — requireWebhookSecret)
 src/app/api/webhooks/clay/route.ts        |  7 ++-- (requireWebhookSecret)
 src/app/api/webhooks/trigify/route.ts     |  7 ++-- (requireWebhookSecret)
 src/app/api/webhooks/n8n/route.ts         |  7 ++-- (requireWebhookSecret)
 src/app/api/webhooks/lemlist/route.ts     |  9 ++++  (fail-closed guard)
 10 files changed, ~114 insertions, ~15 deletions
```

---

## What Was NOT Done (by design)

- ❌ No refactoring
- ❌ No new dependencies added
- ❌ No commits created
- ❌ No deploy triggered
- ❌ No schema changes

---

## Next Steps (pending Vernon's review)

1. `git add` + `git commit` the changes
2. Deploy to Railway staging
3. Verify all 4 webhook endpoints with valid/invalid secrets
4. Verify seed routes return 403 on production env
5. Proceed to Sprint 1 (security headers, rate limiting, Decimal migration)
