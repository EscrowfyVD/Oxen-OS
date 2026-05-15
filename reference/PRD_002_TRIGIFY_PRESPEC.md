# PRD-002 — Trigify Integration (Pre-Spec)

**Auteur** : Vernon Dessy + Claude
**Version** : v1.2 — Phase 2A livrée
**Dernière mise à jour** : 2026-05-15
**Sprint origin** : Sprint Trigify Phase 2A (2026-05-15)

---

## 1. Context

Trigify is a LinkedIn intent-signal vendor — its "Listenings" track activity
on monitored profiles + company pages, and its "Workflows" can fire a
webhook on each event (post likes, comments, profile visits, role
changes, etc.).

The Sprint S1 batch 1 webhook (`/api/webhooks/trigify`) was a placeholder:
it accepted a payload with `email` as primary key, looked up the contact,
and ingested a generic IntentSignal under the deprecated placeholder code
`trigify_intent_signal`. In practice, the real Trigify workflow
"Linkedin oxen" never used that path because Trigify's `Get Post Likes
LinkedIn` action does **NOT** return liker emails — so the placeholder
webhook returned 200 OK but persisted nothing.

**Phase 2A goal** : rewire the webhook to match Trigify's actual payload
shape (LinkedIn URL as primary identifier), map 7 canonical signal types
into SignalTypeRegistry, broadcast Telegram alerts on hot signals to the
BD pool, and dedup at day-level to absorb Trigify's "Last week" rescan
overlap.

---

## 2. Architecture decisions

| Decision | Choice | Why |
|---|---|---|
| Primary contact key | `person_linkedin_url` | Trigify does not return liker emails. LinkedIn URL is the only stable per-person identifier in `Get Post Likes` output. |
| Matching fallback chain | linkedin_url → email → name+company → auto-create | Each step graceful, never blocks on a missing field. Email fallback keeps legacy curl tests + Sprint S1 payloads working. |
| Auto-created contact stage | `lifecycleStage = "intent_sourced"` | Marks Trigify-sourced leads as distinct from manually entered or Clay-enriched contacts. Free-form String (not enum) → no migration needed for the value itself. |
| Auto-created contact email | Deterministic placeholder `<linkedin-slug>@trigify.placeholder` | `CrmContact.email` is NOT NULL UNIQUE. Slug-based placeholder ensures idempotent re-creation on retries. |
| Auto-created company | findFirst by name (case-insensitive) → create with `domain=null` | Trigify does not return company domain. Acceptable risk: occasional name-case duplicates. Manual cleanup later. |
| BD alert routing | Broadcast to ALL emails in `CRM_BD_EMAILS` env var | V1 chooses simplicity. Per-company routing (`Company.assignedBdId`) deferred to V2. |
| Immediate-alert signal codes | `trigify_profile_visit`, `trigify_oxen_engagement_comment` | Profile visit = hot self-selection (7d decay). Comment = high-effort engagement. Other codes are passive enrichment only. |
| Dedup window | 24h UTC, anchored on `createdAt` (= signal date) | Trigify "Last week" Time Frame rescans 7 days every run; workflow fires every 12h with 24h look-back. 24h dedup window matches the natural cadence — same person + same signal type within the same day = one event. |
| Sequence interruption on Trigify signal | **Deferred to Phase 3** | Out of scope for Phase 2A — we only persist signals + alert BDs. Sequence pause logic touches Lemlist orchestration. |
| Mode | B strict — commit local + manual review before push | Per Vernon's preference for non-trivial schema + webhook changes. |

---

## 3. Schema changes

### `prisma/migrations/20260515093000_add_trigify_linkedin_index_and_intent_sourced_stage`

```sql
CREATE INDEX "CrmContact_linkedinUrl_idx" ON "CrmContact"("linkedinUrl");
```

The migration name also references the new `intent_sourced` lifecycle stage,
but no DDL is generated for it — `CrmContact.lifecycleStage` is
`String? @default("new_lead")` (free-form text, not a Prisma enum), so
adding a new accepted value is purely an application-level convention.

### `SignalTypeRegistry` seeds

7 new canonical Trigify codes seeded by
`scripts/db/seed-signal-types.ts` (idempotent upsert by `code`):

| Code | Category | Points | Decay days | Curve | Use |
|---|---|---|---|---|---|
| `trigify_oxen_engagement_comment` | INTENT | 10 | 30 | EXPONENTIAL | Comment on Oxen post — high effort |
| `trigify_oxen_engagement_like` | INTENT | 5 | 30 | EXPONENTIAL | Like on Oxen post — light touch |
| `trigify_profile_visit` | INTENT | 10 | 7 | STEP | Profile visit — short hot window |
| `trigify_competitor_engagement` | INTENT | 6 | 60 | LINEAR | Engaged with competitor content |
| `trigify_follow_competitor` | INTENT | 3 | 90 | LINEAR | Follows a competitor page — passive |
| `trigify_role_change` | INTENT | 6 | 90 | LINEAR | Job change — 90d evaluation window |
| `trigify_bio_change` | INTENT | 3 | 90 | LINEAR | Bio/headline update — weak transition signal |

The legacy `trigify_intent_signal` entry is preserved with `isActive=false`
so historical IntentSignal rows referencing it stay valid; new ingestions
go through `SIGNAL_TYPE_MAPPING` (see below).

---

## 4. Components delivered

| File | Role |
|---|---|
| `src/app/api/webhooks/trigify/route.ts` | Webhook entry point. Orchestrates auth → validation → matching → mapping → dedup → persistence → score recompute → alert. |
| `src/lib/trigify-matching.ts` | `matchContact()` — 4-step resolution chain (linkedin_url → email → name+company → auto-create). |
| `src/lib/trigify-signal-mapping.ts` | `mapSignalTypeToCode()` + `IMMEDIATE_ALERT_SIGNAL_CODES`. Single source of truth for the payload → canonical code → alert decision flow. |
| `src/lib/trigify-dedup.ts` | `findExistingSignal()` — day-level idempotence anchored on `createdAt + signalTypeId + contactId`. |
| `src/lib/trigify-alerts.ts` | `maybeAlertBDs()` — gated broadcast to `CRM_BD_EMAILS` via `notifyEmployee()`. HTML-escaped message body. |
| `src/app/api/webhooks/_schemas.ts` | `trigifyWebhookSchema` — Phase 2A fields + legacy Sprint S1 backward-compat fields. All optional. |
| `scripts/db/seed-signal-types.ts` | Adds 7 Trigify seeds + flips legacy placeholder to `isActive=false`. Now 14 total entries. |

### Response shapes (all 200 except auth/validation failures)

| `action` | When | Notes |
|---|---|---|
| `ingested` | Signal persisted | Includes `signal_id`, `signal_code`, `match_method`, `alerted` |
| `duplicate_skipped` | Same-day match found | No alert sent, no second persistence |
| `no_match` | Payload had no linkedin_url + no email + no name | Defensive guard against ghost contacts |
| `registry_unavailable` | Resolved code is inactive (e.g. deprecated placeholder) or missing | Trigify will not retry (200 OK) |
| `error` | Caught exception | Logged via `serializeError`; 200 to avoid Trigify retry storm |

---

## 5. Tests

27 new tests in `src/app/api/webhooks/trigify/route.test.ts`, organized by
concern:

| Section | Tests | Coverage |
|---|---|---|
| [1] Authentication | 3 | Missing / wrong / correct secret |
| [2] Zod validation | 3 | Invalid URL, full Phase 2A, full legacy |
| [3] LinkedIn URL matching | 2 | Hit + insensitive-mode query shape |
| [4] Email fallback | 1 | Legacy payload (no linkedin_url) |
| [5] Name+company fuzzy | 1 | Last-resort match |
| [6] Auto-create | 3 | Contact-only, contact+company, deterministic placeholder email |
| [7] Dedup | 3 | Same day skip, next-day pass, no alert on duplicate |
| [8] Signal type mapping | 3 | Known → canonical, unknown → registry_unavailable, missing → registry_unavailable |
| [9] Telegram alerts | 4 | profile_visit broadcasts, comment broadcasts, competitor_engagement no-alert, empty env safe |
| [10] Persistence | 4 | contactId+signalTypeId, points override, default points, metadata shape |

Plus 8 net new tests in `scripts/db/seed-signal-types.test.ts` (16 total,
covering all 14 seed entries + deprecation contract).

**Full suite : 343 tests, 0 regression.**

---

## 6. Operational notes

### Deploy sequence (Railway)

1. Push merges to `main` → Railway auto-deploys.
2. `prisma migrate deploy` (run by Railway start script or manually): applies the new index migration.
3. Run seed manually after deploy:
   ```bash
   npx tsx scripts/db/seed-signal-types.ts
   ```
   Output should report 14 upserts. Re-running is safe (idempotent).
4. Confirm `TRIGIFY_WEBHOOK_SECRET` and `CRM_BD_EMAILS` are set in Railway env vars.

### Trigify dashboard

The "Linkedin oxen" workflow stays Enabled. The HTTP Request action's
payload template **must** include `person_linkedin_url` (mapped from
`{{getPostLikesLinkedIn.data.items[N].profileUrl}}`) — without it, the
webhook cannot match likers and will auto-create placeholder contacts.

To extend to the other 6 Listenings (Kea Bank, The Kingdom Bank, Airwallex,
Paybis, OXEN page, Paul profile): duplicate the workflow per Listening
with the appropriate `competitor_name` value baked into the payload.

### Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| 401 on Trigify side | `TRIGIFY_WEBHOOK_SECRET` mismatch | Re-paste secret in Trigify HTTP action headers |
| `action: registry_unavailable` in logs | Seed never ran on Railway, or `signal_type` not in `SIGNAL_TYPE_MAPPING` | Run seed; add the new `signal_type` to `SIGNAL_TYPE_MAPPING` |
| `action: no_match` | Workflow sends no usable identifier | Verify the HTTP Request template includes at least `person_linkedin_url` |
| No Telegram alert despite hot signal | `CRM_BD_EMAILS` empty, or the resolved code isn't in `IMMEDIATE_ALERT_SIGNAL_CODES` | Set env var; check `signal_code` in response body |
| Duplicate signals per day | Dedup not running | Check that `signalDate` parses cleanly; bad ISO strings fall back to `new Date()` which still dedups per day, but multi-day rescans rely on the workflow setting `signal_date` correctly |

---

## 7. Out of scope (deferred)

- **Sequence interruption** on hot Trigify signal — Phase 3 (touches Lemlist orchestration).
- **`Company.assignedBdId`** for per-company alert routing — V2 (broadcast V1 is sufficient).
- **Replacing the legacy placeholder upsert path** in webhook signal-typing — already handled by the SignalTypeRegistry deprecation flow; no further work.
- **Per-Listening workflow duplication** — operator task once Phase 2A is validated in prod.

---

## 8. Sprint plan

| Sprint | Status | Date | Output |
|---|---|---|---|
| Phase 2A — Webhook + matching + alerts | ✅ LIVRÉ | 2026-05-15 | commits TBD on `claude/xenodochial-borg-038829` branch |
| Phase 2B — Per-Listening workflow rollout (operator) | ⏳ Pending Vernon | after prod validation 24-48h | n/a |
| Phase 3 — Sequence interruption on hot signals | 🕓 Backlog | TBD | depends on Lemlist orchestration design |
| V2 — Per-company BD routing | 🕓 Backlog | TBD | requires `Company.assignedBdId` migration |

---

## 9. Changelog

### v1.2 — 2026-05-15 (Phase 2A delivered)
- Webhook rewired from placeholder to production-ready implementation.
- 7 canonical Trigify SignalTypeRegistry codes seeded.
- Day-level dedup, Telegram broadcast on hot signals, LinkedIn-first matching with fallback chain.
- 27 new tests, full suite 343/343 passing.

### v1.1 — 2026-05-14 (Pre-spec drafted)
- Architecture decisions enumerated (matching, alerts, dedup, lifecycle).
- Identified placeholder webhook gap (email-only matching incompatible with Trigify payload).

### v1.0 — Initial draft
- Sprint S1 placeholder webhook (`trigify_intent_signal` registry entry).
