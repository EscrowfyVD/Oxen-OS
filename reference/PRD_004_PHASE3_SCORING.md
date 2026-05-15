# PRD-004 — Phase 3 Scoring Engine

**Version** : v1.0 — pré-spec (basée sur Andy Reference Doc May 2026)  
**Date** : 2026-05-15 (vendredi soir)  
**Auteur** : Vernon Dessy + Claude (basé sur "Oxen OS Priority Scoring Engine v2" par Andy)  
**Status** : 📋 Ready for review → Sprint split en phases  
**Estimation** : **3-4 semaines focus** (4 sub-sprints)  
**Audience** : Vernon, Andy (author specs), PM futur, Johnny Le si pair-programming

---

## Executive Summary

Phase 3 Scoring Engine = **automation finale** du pipeline Oxen OS. Une fois livré, le système calcule automatiquement :
- ICP Score (0-50) par account
- Intent Score (0-50) par account (avec time decay)
- Priority Score combined (0-100)
- Priority Level (P1 / P2 / P3 / Monitor)
- Pain Tier inference (T1 / T2 / T3)
- Negative signals processing
- Follow-up trigger logic (accelerate Lemlist sequences)

**Sortie attendue** : BD ouvre Intent Feed → les signaux sont déjà triés par **vrai Priority Score**, pas plus par proxy score V1. Sequences Lemlist s'auto-adaptent. BD est alerté Telegram automatiquement sur P1 promotions.

**Pourquoi maintenant** : Andy a livré le reference document complet (May 2026). Toutes les décisions sont prises. **Plus aucun blocage Andy**. On peut implémenter immédiatement.

**Scope strict** : ce PRD couvre **le scoring engine core**. Hors scope (PRDs séparés) :
- ❌ Apify + n8n source pipelines (Cat C, D, E, F, I) → PRD-005 séparé
- ❌ Apollo switch from Clay (Cat F, G) → PRD-006 séparé
- ❌ Oxen website analytics (Cat A) → PRD-007 séparé
- ❌ Admin UI full configurability → V2 (V1 = JSONB config + scripts)
- ❌ Market-wide signals + campaigns → PRD-008 séparé

**V1 implémentation** : on utilise les sources existantes (Trigify Cat H, Clay legacy data, Lemlist Cat B partial). Le scoring marche immédiatement avec ce qu'on a en DB. Les autres sources s'ajoutent progressivement.

---

## 1. Context & Objectives

### 1.1 État actuel — pipeline incomplet

```
✅ Data IN actuel:
  - Trigify (Cat H) — engagement LinkedIn competitors
  - Clay enrichment — 1586 Companies + 597 Contacts G1-T1
  - Lemlist webhooks — partial (Cat B)
  
✅ Storage:
  - IntentSignal table (avec decay daily cron)
  - SignalTypeRegistry (13 codes active)
  - CrmContact + Company (acquisition source tracking)
  
✅ UI Consumption:
  - Intent Feed V1 (livré 15 mai) avec proxy score sort
  
🔴 GAPS:
  - Pas de Priority Score combined ICP+Intent
  - Pas de Priority Level (P1/P2/P3/Monitor)
  - Pas de Pain Tier inference
  - Pas de negative signals processing
  - Pas de follow-up triggers (sequence acceleration)
  - Pas de /api/signals universal endpoint
  - Pas de /api/accounts fuzzy match
  - Sequence Lemlist orchestration manuelle (BD décide)
```

### 1.2 Place dans roadmap

```
✅ Feature #1  — Trigify Phase 2A           (15 mai)
✅ Feature #2  — Clay enrichment            (Sprint S0.5+S1)
✅ Feature #3  — Intent Feed UI             (15 mai)
🔴 Feature #4  — Apify + n8n                (PRD-005, séparé)
🔴 Feature #5  — Intel Page                 (V2 backlog)
✅ Feature #6  — Group routing G1-G7B       (Sprint S0)
✅ Feature #7  — Priority Levels schema     (Sprint S0)
✅ Feature #8  — Pain Tiers schema          (Sprint S0)
🟢 Feature #9  — Scoring Engine global      (CE PRD)         ← UNBLOCKED
🟢 Feature #10 — Sequence interruption hot  (CE PRD inclus)  ← UNBLOCKED
🟢 Feature #11 — Tier transitions auto      (CE PRD inclus)  ← UNBLOCKED
✅ Feature #12 — Lemlist sequences          (Sprint S0.6)
✅ Feature #13 — Conference Brief AI        (Sprint #13)
✅ Feature #14 — CRM slide-over Clay        (Sprint Quick Wins)
```

→ Ce PRD débloque **3 features bloquées** (#9, #10, #11). Après livraison : **12/14 features = 86% roadmap Andy**.

### 1.3 Objectifs Phase 3 Scoring

1. **Auto Priority Score** par account → tri auto Intent Feed
2. **Auto Priority Level** (P1/P2/P3/Monitor) → entry rule sequence automatique
3. **Auto Pain Tier** inference (T1/T2/T3) → sequence variant routing
4. **Auto Follow-up Triggers** → Lemlist sequence acceleration (no pause)
5. **Negative Signals** → auto exclusion / nurture
6. **BD Alerting** auto sur P1 promotion (Telegram + Intent Feed badge)
7. **Configuration-driven** → BD team peut ajuster weights/thresholds sans dev (V1 = JSONB config, V2 = Admin UI)

### 1.4 Non-objectifs V1 (out of scope ce PRD)

- ❌ Admin UI configurability complete (V1 = JSONB, V2 = full UI)
- ❌ Sources pipelines new (Apify, Apollo, Oxen analytics) → PRDs séparés
- ❌ Market-wide signals + campaigns → PRD-008
- ❌ Scoring version comparison analytics
- ❌ Retroactive score backfill for old data (V1 = score new + on-demand)

---

## 2. Architecture

### 2.1 Schema changes

#### 2.1.1 New table : `ScoringConfig`

Storage configuration JSONB versioned. Une seule ligne active à la fois.

```prisma
model ScoringConfig {
  id              String   @id @default(cuid())
  version         Int      @unique
  isActive        Boolean  @default(false)
  config          Json     // JSONB blob (see structure §2.2)
  createdAt       DateTime @default(now())
  createdBy       String?  // employee email
  notes           String?  // changelog message
  
  @@index([isActive])
  @@index([version])
}
```

**Une seule config active** à la fois. Changements → new version + isActive flag flip.

#### 2.1.2 New table : `ScoreHistory`

Audit trail des scores par account.

```prisma
model ScoreHistory {
  id              String   @id @default(cuid())
  accountId       String   // FK to CrmContact OR Company (polymorphic)
  accountType     String   // "contact" or "company"
  configVersion   Int      // FK to ScoringConfig.version used
  icpScore        Float
  intentScore     Float
  priorityScore   Float
  priorityLevel   String   // P1 / P2 / P3 / Monitor
  signalCount     Int
  painTier        String?  // T1 / T2 / T3 (nullable, inferred separately)
  computedAt      DateTime @default(now())
  
  @@index([accountId, computedAt])
  @@index([priorityLevel])
  @@index([configVersion])
}
```

#### 2.1.3 Extensions tables existantes

**CrmContact** (add ICP-related fields if missing) :
```prisma
model CrmContact {
  // ... existing fields ...
  
  // Phase 3 additions:
  icpScore         Float?    @default(0)
  intentScore      Float?    @default(0)
  priorityScore    Float?    @default(0)
  priorityLevel    String?   // P1 / P2 / P3 / Monitor (default Monitor)
  painTier         String?   // T1 / T2 / T3 (nullable)
  painTierOverride String?   // BD manual override
  excludedFrom     String[]  @default([]) // "outreach", "scoring", etc.
  excludedReason   String?
  lastScoredAt     DateTime?
  signalCount      Int       @default(0)
  
  // Existing relations
  // ...
}
```

**IntentSignal** (add category + level) :
```prisma
model IntentSignal {
  // ... existing fields ...
  
  // Phase 3 additions:
  category         String?   // A / B / C / D / E / F / G / H / I
  signalLevel      String?   // "contact" or "account"
  
  // Existing fields kept (points, decayedPoints, signalType, source, etc.)
}
```

**SignalTypeRegistry** (add category + level metadata) :
```prisma
model SignalTypeRegistry {
  // ... existing fields ...
  
  // Phase 3 additions:
  category         String?   // A / B / C / D / E / F / G / H / I
  signalLevel      String    @default("contact") // "contact" or "account"
  triggerType      String?   // "immediate" / "rapid" / "passive"
  
  // Existing fields kept
}
```

### 2.2 ScoringConfig JSONB structure

Cette structure est versionnée et editable. **C'est la "source of truth"** de tous les weights/thresholds.

```typescript
interface ScoringConfigBlob {
  // §2.2.1 — Entry rules
  entryRules: {
    minPriorityScore: number          // 40
    minSignalCount: number            // 2
  }
  
  // §2.2.2 — Priority Levels (P1/P2/P3/Monitor)
  priorityLevels: {
    P1: { minScore: number, minSignals: number, responseHours: number }  // 75, 3, 2
    P2: { minScore: number, minSignals: number, responseHours: number }  // 55, 2, 24
    P3: { minScore: number, minSignals: number, responseHours: number }  // 40, 2, null (standard)
    Monitor: { /* fallback */ }
  }
  
  // §2.2.3 — ICP Factors
  icpFactors: {
    intermediaryType: {
      maxPoints: number               // 15
      tiers: {
        primary: { points: number, groups: string[] }    // 15, [G1-G7B]
        secondary: { points: number }                     // 10
        peripheral: { points: number }                    // 5
      }
    }
    companySize: {
      maxPoints: number               // 10
      brackets: {
        ideal: { points: number, employeesMin: number, employeesMax: number, revenueMin: number }
        viable: { points: number, ... }
        edgeCases: { points: number, ... }
      }
    }
    decisionMakerAccess: {
      maxPoints: number               // 10
      direct: number                  // 10 (CEO/CFO/COO with verified email)
      partial: number                 // 5
      none: number                    // 0
    }
    geography: {
      maxPoints: number               // 10
      primary: { points: number, jurisdictions: string[] }  // 10, [Malta, Cyprus, UAE, Luxembourg, UK]
      secondary: { points: number, jurisdictions: string[] }  // 5, [EU, APAC]
      outOfScope: { points: number }  // 0
    }
    patternMatch: {
      maxPoints: number               // 5
      strongMatch: number             // 5 (type + size + jurisdiction)
      partialMatch: number            // 3 (2/3 dimensions)
      noMatch: number                 // 0
    }
  }
  
  // §2.2.4 — Intent Categories (A-I)
  intentCategories: {
    A: {
      name: "Direct Oxen Engagement"
      level: "contact"
      signals: {
        direct_message_oxen: { points: number, code: string }
        oxen_pricing_demo_visit: { points: number, code: string }
        oxen_substantive_comment: { points: number, code: string }
        bd_profile_visit_post_email: { points: number, code: string }
        oxen_post_like: { points: number, code: string }
      }
    }
    B: { /* Lemlist - similar structure */ }
    C: { /* Public banking frustration */ }
    D: { /* Competitive signals */ }
    E: { /* Regulatory */ }
    F: { /* Financial */ }
    G: { /* Recruitment */ }
    H: { /* LinkedIn Trigify - already populated */ }
    I: { /* Indirect social */ }
  }
  
  // §2.2.5 — Time Decay
  timeDecay: {
    brackets: [
      { maxDays: 7, coefficient: 1.0 }
      { maxDays: 30, coefficient: 0.75 }
      { maxDays: 90, coefficient: 0.5 }
      { maxDays: null, coefficient: 0 }  // expired
    ]
  }
  
  // §2.2.6 — Negative Signals
  negativeSignals: {
    soft_not_interested: { impact: -10, action: "nurture" }
    hard_not_interested: { impact: 0, action: "exclude" }
    email_bounce: { impact: -15, action: "flag_invalid" }
    contact_left_company: { impact: 0, action: "reset_contact" }
    company_exited_space: { impact: 0, action: "exclude" }
    lemlist_unsubscribe: { impact: 0, action: "exclude" }
    no_response_after_sequence: { impact: -5, action: "nurture_6_months" }
  }
  
  // §2.2.7 — Follow-up Triggers
  followUpTriggers: {
    immediate: {
      windowHours: number  // 2
      signals: string[]    // codes that trigger immediate adjust
    }
    rapid: {
      windowHours: number  // 24
      signals: string[]
    }
    passive: {
      signals: string[]    // score only, no sequence adjust
    }
  }
  
  // §2.2.8 — Pain Tier inference
  painTier: {
    inferenceRules: {
      T1: { conditions: [...] }  // active losing business
      T2: { conditions: [...] }  // constant friction
      T3: { conditions: [...] }  // suboptimal solution
    }
    bdOverrideEnabled: boolean  // true
  }
}
```

→ Stored as JSONB in `ScoringConfig.config`. Migrations versioned.

### 2.3 Compute engine architecture

```
┌──────────────────────────────────────────────────────────────────┐
│ Signal ingestion (existing webhooks → new /api/signals)          │
└──────────────────────────────────────────────────────────────────┘
                                ↓
┌──────────────────────────────────────────────────────────────────┐
│ /api/signals universal endpoint                                   │
│   - Validate payload                                              │
│   - CRM lookup (fuzzy match or by ID)                            │
│   - Existing lead? → attach signal + recompute score             │
│   - New lead? → enrich (Apollo) + create + compute initial       │
└──────────────────────────────────────────────────────────────────┘
                                ↓
┌──────────────────────────────────────────────────────────────────┐
│ Score recalculation engine (sync or async)                       │
│   1. Fetch active ScoringConfig                                   │
│   2. compute_icp_score(account)                                   │
│   3. compute_intent_score(account) — with decay                  │
│   4. priorityScore = icp + intent                                 │
│   5. Determine priority_level (P1/P2/P3/Monitor)                  │
│   6. Determine painTier (if not overridden)                       │
│   7. Save to CrmContact + ScoreHistory                            │
│   8. If level changed → trigger actions                           │
└──────────────────────────────────────────────────────────────────┘
                                ↓
┌──────────────────────────────────────────────────────────────────┐
│ Action triggers                                                   │
│   - P1 promotion → Telegram alert BDs                            │
│   - Sequence entry (if score >= 40 AND signals >= 2)             │
│   - Sequence acceleration (immediate/rapid triggers)             │
│   - Sequence adapt rewrite (integrate new signal)                 │
└──────────────────────────────────────────────────────────────────┘
                                ↓
┌──────────────────────────────────────────────────────────────────┐
│ Intent Feed UI re-renders avec new priority_score sort           │
│ Lemlist sequences accelerated via API                             │
└──────────────────────────────────────────────────────────────────┘
```

---

## 3. Sub-Sprints — découpage 4 semaines

### Sprint Plan global

| Sprint | Effort | Description |
|---|---|---|
| **Sprint 3a — Schema + Config foundation** | ~1 sem | Tables, JSONB config seed, migration data existante |
| **Sprint 3b — Compute engine (ICP+Intent+Decay)** | ~1 sem | Pure compute functions + tests |
| **Sprint 3c — Priority Level + Pain Tier + Negative signals** | ~1 sem | Level assignment, inference, exclusions |
| **Sprint 3d — Triggers + Lemlist orchestration + Intent Feed integration** | ~1 sem | Follow-up triggers, BD alerts, UI integration |

**TOTAL : ~4 semaines focus** (de 1 dev focus + Claude pair-programming).

---

## 4. Sprint 3a — Schema + Config foundation (~1 sem)

### 4.1 Objectifs
- Tables Prisma + migrations
- Seed initial ScoringConfig v1 (toutes les valeurs du doc Andy)
- Migration retroactive : assign Cat A-I to existing SignalTypeRegistry codes
- Foundation pour Sprint 3b

### 4.2 Files livrés

```
prisma/migrations/2026XXXX_phase3_scoring_foundation/
  ├── migration.sql

prisma/schema.prisma                              ← Updates
  - ScoringConfig (new model)
  - ScoreHistory (new model)
  - CrmContact extensions (icpScore, priorityLevel, etc.)
  - IntentSignal extensions (category, signalLevel)
  - SignalTypeRegistry extensions (category, signalLevel, triggerType)

scripts/db/seed-scoring-config.ts                ← Seed initial config v1
scripts/db/migrate-signal-types-to-categories.ts ← Backfill Cat A-I codes
scripts/db/seed-scoring-config.test.ts           ← Tests seed

src/lib/scoring/
  ├── config-loader.ts                           ← Fetch active config
  ├── config-types.ts                            ← TypeScript interfaces
  └── config-validation.ts                       ← Zod schema for JSONB
```

### 4.3 Batches

**B1 (1 jour) — Schema Prisma + migration**
- Add ScoringConfig + ScoreHistory models
- Extend CrmContact + IntentSignal + SignalTypeRegistry
- Generate migration SQL
- Apply migration on Railway prod

**B2 (1 jour) — Seed ScoringConfig v1**
- Build initial JSONB config from Andy's doc verbatim
- Insert as version=1, isActive=true
- Tests : validate structure with Zod

**B3 (1 jour) — Backfill Categories on SignalTypeRegistry**
- Map existing codes to A-I categories
  - `trigify_*` → Cat H
  - `clay_*` → Cat E/F/G (Clay enrichment maps to regulatory/financial/recruitment)
  - `lemlist_*` → Cat B (if exist)
  - Placeholders → null (deprecated)
- Update signalLevel ("contact" / "account")
- Update triggerType ("immediate" / "rapid" / "passive")

**B4 (1 jour) — Config loader + validation lib**
- `getActiveScoringConfig()` → fetches + caches active config
- `validateScoringConfig(json)` → Zod validation
- TypeScript interfaces for type safety

**B5 (1 jour) — Tests + commit**
- Unit tests : config loader, validation, seed
- Integration test : DB has scoring config v1 active
- Commit local + push

### 4.4 Acceptance criteria Sprint 3a

- [ ] ScoringConfig table avec v1 active en prod
- [ ] CrmContact extended fields (default values)
- [ ] All existing SignalTypeRegistry codes mapped to Cat A-I
- [ ] Config loader fetches in <50ms (cache)
- [ ] Zod validation prevents malformed configs
- [ ] Tests all passing
- [ ] Commit + push to main

---

## 5. Sprint 3b — Compute engine (~1 sem)

### 5.1 Objectifs
- Pure compute functions ICP + Intent + Decay
- Pas de side effects (no DB writes V1, return values only)
- Heavy testing (this is core math)

### 5.2 Files livrés

```
src/lib/scoring/
  ├── compute-icp-score.ts                    ← ICP factors 5 dimensions
  ├── compute-intent-score.ts                 ← Intent with decay
  ├── compute-priority-score.ts               ← icp + intent
  ├── apply-time-decay.ts                     ← Decay coefficient per signal
  ├── pattern-match.ts                        ← Pattern Match algorithm (Factor 2.5)
  └── tests/
      ├── compute-icp-score.test.ts           ← ~15 tests
      ├── compute-intent-score.test.ts        ← ~15 tests
      ├── apply-time-decay.test.ts            ← ~10 tests
      └── pattern-match.test.ts               ← ~8 tests
```

### 5.3 Batches

**B1 (1 jour) — Time decay**
- `applyTimeDecay(signal, config): decayedPoints`
- Read config brackets (7/30/90/expired)
- Tests : signal at 0d, 5d, 15d, 60d, 100d
- Verify edge cases (exactly 7d boundary, etc.)

**B2 (1.5 jours) — ICP Score compute**
- `computeICPScore(account, config): { score, breakdown }`
- 5 factors compute:
  1. Intermediary Type (group lookup → Primary/Secondary/Peripheral)
  2. Company Size (employees + revenue lookup → bracket)
  3. Decision-Maker Access (email verified + title lookup)
  4. Geography (jurisdiction lookup → tier)
  5. Pattern Match (DB query existing converted clients)
- Tests : 15 scenarios couvrant edge cases

**B3 (1.5 jours) — Intent Score compute**
- `computeIntentScore(account, config): { score, breakdown, signalCount }`
- Query all IntentSignals for account (last 90 days)
- Apply decay per signal
- Sum by category
- Cap at 50 (max Intent Score)
- Return breakdown by category (for UI)
- Tests : multi-signal, decay, cap edge case

**B4 (0.5 jour) — Priority Score combined**
- `computePriorityScore(account, config): { icp, intent, total, signalCount }`
- Simple : `total = icp + intent`
- Tests

**B5 (1 jour) — Pattern Match algorithm**
- Query CrmContact + Deal (stage closed_won) → existing patterns
- Compare new account: type/size/jurisdiction
- Return strongMatch / partialMatch / noMatch
- Tests with seeded test data

**B6 (0.5 jour) — Polish + commit**
- All tests passing
- Commit local

### 5.4 Acceptance criteria Sprint 3b

- [ ] computeICPScore returns 0-50 with valid breakdown
- [ ] computeIntentScore returns 0-50 with decay applied
- [ ] computePriorityScore returns 0-100
- [ ] applyTimeDecay correct at all boundaries
- [ ] Pattern Match algorithm tested with seed data
- [ ] ~50 unit tests added (target: 410/410 total)
- [ ] No DB writes V1 (pure functions only)
- [ ] Commit + push

---

## 6. Sprint 3c — Priority Level + Pain Tier + Negative signals (~1 sem)

### 6.1 Objectifs
- Priority Level assignment (P1/P2/P3/Monitor) from score + signals
- Pain Tier inference algorithm
- Negative signals processing
- Persist scores to CrmContact + ScoreHistory

### 6.2 Files livrés

```
src/lib/scoring/
  ├── assign-priority-level.ts                ← Level from score + signals
  ├── infer-pain-tier.ts                      ← T1/T2/T3 from signals + context
  ├── apply-negative-signals.ts               ← Exclusions + deductions
  ├── persist-score.ts                        ← DB write to CrmContact + ScoreHistory
  └── tests/
      ├── assign-priority-level.test.ts
      ├── infer-pain-tier.test.ts
      ├── apply-negative-signals.test.ts
      └── persist-score.test.ts
```

### 6.3 Batches

**B1 (1 jour) — Assign Priority Level**
- `assignPriorityLevel({ score, signalCount }, config): "P1" | "P2" | "P3" | "Monitor"`
- Hard entry rule check (score ≥ 40 AND signals ≥ 2)
- Use config thresholds (75/55/40)
- Tests

**B2 (1.5 jours) — Pain Tier inference**
- `inferPainTier(account, signals, context, config): "T1" | "T2" | "T3" | null`
- Rules from Andy doc :
  - T1 : Cat C signals recent + active distress context
  - T2 : multiple Cat D/E signals over time + size context
  - T3 : default if no strong T1/T2 signals
- Respect BD override (CrmContact.painTierOverride)
- Tests with various scenarios

**B3 (1.5 jours) — Negative signals processing**
- `applyNegativeSignals(account, signals, config): { adjustedScore, exclusions, actions }`
- Process each negative signal type
- Compute deductions OR exclusions OR resets
- Return list of actions (nurture, exclude, flag_invalid, etc.)
- Tests for each negative signal type

**B4 (1 jour) — Persist score to DB**
- `persistScore(account, scoreData, configVersion): void`
- Update CrmContact (icpScore, intentScore, priorityScore, priorityLevel, painTier, lastScoredAt, signalCount)
- Insert ScoreHistory row (audit)
- Transaction (rollback on failure)
- Tests

**B5 (1 jour) — Recalculation endpoint + cron**
- `POST /api/scoring/recalculate?account_id=...` (manual trigger)
- `POST /api/scoring/recalculate-all` (admin only, batch)
- Cron daily : recalculate all active prospects (decay refresh)
- Tests

### 6.4 Acceptance criteria Sprint 3c

- [ ] Priority Level assigned correctly per Andy rules
- [ ] Pain Tier inferred (with BD override respected)
- [ ] Negative signals processed (exclusions + deductions)
- [ ] Scores persisted to DB + ScoreHistory audit
- [ ] Recalculation endpoint works
- [ ] Cron daily decay refresh
- [ ] Tests 430+/430+ passing
- [ ] Commit + push

---

## 7. Sprint 3d — Triggers + Orchestration + UI integration (~1 sem)

### 7.1 Objectifs
- Follow-up Triggers (immediate/rapid/passive)
- Lemlist sequence orchestration (accelerate + adapt, no pause)
- BD alerting Telegram on P1 promotion
- Intent Feed UI integration (real Priority Score sort)
- /api/signals universal endpoint
- /api/accounts fuzzy match endpoint

### 7.2 Files livrés

```
src/lib/scoring/
  ├── classify-trigger.ts                     ← immediate/rapid/passive from signal
  ├── orchestrate-sequence.ts                 ← Lemlist API integration
  ├── alert-bds.ts                            ← Telegram BD alerts on P1
  └── tests/...

src/app/api/signals/route.ts                  ← Universal POST endpoint
src/app/api/accounts/route.ts                 ← GET fuzzy match
src/app/api/scoring/recalculate/route.ts      ← Manual recalc

src/app/crm/intent-feed/page.tsx              ← Update sort by real priority_score
src/app/crm/intent-feed/_components/SignalCard.tsx ← Show P1/P2/P3 badge
```

### 7.3 Batches

**B1 (0.5 jour) — /api/accounts fuzzy match**
- `GET /api/accounts?name=...`
- Fuzzy match using Postgres `pg_trgm` or simpler LIKE
- Return top 5 with confidence scores
- Tests

**B2 (1 jour) — /api/signals universal endpoint**
- `POST /api/signals` (replaces existing webhooks gradually)
- Validate payload Zod
- Lookup account (use fuzzy match)
- If existing: attach signal + trigger recompute
- If new: enrich via Apollo (V2) OR auto-create like Trigify Phase 2A (V1)
- Trigger compute_priority_score
- Return : { signal_id, account_id, score_change, level_change }
- Tests

**B3 (1 jour) — Classify trigger + orchestrate**
- `classifyTrigger(signalCode, config): "immediate" | "rapid" | "passive"`
- `orchestrateSequence(account, trigger, signalContext): { action, lemlistUpdate }`
- Logic from Andy doc :
  - immediate (2h) : accelerate + rewrite next touch
  - rapid (24h) : advance + adapt
  - passive : score only
- Integration Lemlist API : update sequence next_send_at + custom_variables
- Tests

**B4 (1 jour) — BD alerts Telegram**
- `alertBDsOnLevelChange(account, oldLevel, newLevel)`
- If P3/Monitor → P1 : alert all BDs immediately
- If P3/Monitor → P2 : alert (less urgent)
- Format Telegram message with context
- Reuse notifyEmployee helper
- Tests

**B5 (1 jour) — Intent Feed UI integration**
- Replace proxy score sort by `priorityScore` from DB
- Add P1/P2/P3/Monitor badge on SignalCard
- Add filter "Priority Level" dropdown
- Add hot signal filter logic update (P1 = always hot, not just proxy score)
- Tests UI minimal (V2 RTL)

**B6 (0.5 jour) — End-to-end testing + commit**
- E2E test : inject signal → score updates → level changes → alert sent → UI reflects
- Polish, lint, tests
- Commit + push

### 7.4 Acceptance criteria Sprint 3d

- [ ] /api/signals universal endpoint works
- [ ] /api/accounts fuzzy match works (target 90%+ accuracy)
- [ ] Triggers classified per Andy rules
- [ ] Sequence orchestration calls Lemlist API correctly
- [ ] BD Telegram alerts on P1 promotion working
- [ ] Intent Feed shows P1/P2/P3 badges
- [ ] Intent Feed sorts by real priority_score
- [ ] E2E test passes (inject → process → alert → UI)
- [ ] Tests 450+/450+ passing
- [ ] Commit + push to prod

---

## 8. Decisions taken & pending

### Decisions taken (from Andy doc)

| Décision | Choix | Source |
|---|---|---|
| Priority Score formula | ICP + Intent (0-100) | Andy doc §1 |
| Entry rule | ≥40 score AND ≥2 signals | Andy doc §1 |
| ICP max | 50 | Andy doc §2 |
| Intent max | 50 | Andy doc §4 |
| Priority Levels | P1 75+/3+ (2h), P2 55-74/2+ (24h), P3 40-54/2+ (std), Monitor <40 OR <2 | Andy doc §7 |
| Time decay | 7/30/90 days at 100/75/50/0% | Andy doc §5 |
| Sequence on signal | Never pause, always accelerate + rewrite | Andy doc §8 |
| Pain Tier | Routing only, NOT scoring | Andy doc §3 |
| Pain Tier BD override | Allowed | Andy doc §3 |
| Signal Categories | A through I (9 categories) | Andy doc §4 |
| Negative signals | Various deductions + exclusions | Andy doc §6 |
| Configuration storage | JSONB versioned, fully editable | Andy doc §13 |

### Decisions pending (V1 vs V2)

| Décision | V1 reco | V2 |
|---|---|---|
| Admin UI complete | JSONB config seed + SQL/script edits | Full UI all parameters |
| Scoring version comparison | None V1 | Analytics dashboard |
| Retroactive backfill | Only on-demand | Auto backfill all |
| Cat A signals (Oxen analytics) | Skip V1 (PRD-007 séparé) | PRD-007 |
| Cat C/D/E/F/I signals (Apify+n8n) | Skip V1 (PRD-005 séparé) | PRD-005 |
| Cat G (PredictLeads via Apollo) | Skip V1 (PRD-006 Apollo switch) | PRD-006 |
| Market-wide signals | Skip V1 (PRD-008 séparé) | PRD-008 |

→ **V1 fonctionne avec sources actuelles** (Cat H Trigify + Cat B Lemlist partial + Cat E/F/G from Clay legacy).

→ **V2 progressivement** ajoute les autres sources.

### Questions pending Andy (à clarifier au moment Sprint 3c)

**Q1 — Pain Tier inference exact rules**

Andy dit "inferred from Cat C/D/E + company context". Mais l'algo exact :
- T1 : combien de Cat C signals récents minimum ?
- T2 : combien de Cat D/E signals ?
- T3 : default ?

**Reco** : drafter algo proposal Sprint 3c, faire valider à Andy avant deploy.

**Q2 — Apollo enrichment new leads vs Trigify auto-create**

Andy mentionne "new lead → Apollo enrichment". Mais on a actuellement auto-create via Trigify Phase 2A (placeholder email `<slug>@trigify.placeholder`).

→ **Reco V1** : garder Trigify auto-create + enrichir via Clay/Apollo on next sync. V2 = Apollo real-time enrichment.

**Q3 — Sequence "rewrite" automation**

Andy dit "accelerate + rewrite next touch to integrate signal". Mais le rewrite est :
- Manuel (BD edit Lemlist sequence) ?
- AI-generated (Claude API) ?
- Template variables substitution (signal context inserted) ?

→ **Reco V1** : template variables substitution + BD notification "review next touch before send". V2 = AI rewrite Claude.

**Q4 — Configuration changes audit**

Andy mentionne "scoring version system" as configurable. Pour V1 :
- Si Andy change un weight → recompute all immediately ?
- Async batch in background ?
- Versioning des scores historiques ?

→ **Reco V1** : every config change → bump version, cron daily recompute, ScoreHistory tracks configVersion used.

---

## 9. Risks & mitigations

### Risk R1 — Performance recompute large dataset
**Severity** : Medium  
**Volume actuel** : 597 contacts + 1586 companies = ~2200 accounts to score  
**Risk** : Daily cron recompute all = slow if poorly indexed  
**Mitigation** : 
- Index sur `CrmContact.lastScoredAt`
- Batch process 100 accounts à la fois
- Only recompute if signals changed since lastScoredAt
- Tests perf : 2200 accounts < 5 min

### Risk R2 — Lemlist API rate limits
**Severity** : Medium  
**Risk** : Sequence acceleration via Lemlist API → si beaucoup de triggers en parallèle, rate limit hit  
**Mitigation** : 
- Rate limit our requests to Lemlist (~5/sec)
- Queue system (Bull / pg-boss)
- Retry with exponential backoff
- Monitor

### Risk R3 — Pattern Match algorithm complexity
**Severity** : Low  
**Risk** : Pattern Match (§2.5 ICP factor) needs query against existing converted clients → complex SQL  
**Mitigation** : Materialized view daily refresh + simple LIKE/trigram match V1. V2 = ML similarity.

### Risk R4 — Pain Tier inference accuracy
**Severity** : Medium  
**Risk** : Rules-based inference might miscategorize (T1/T2/T3)  
**Mitigation** : 
- BD override always available
- Audit log : ScoreHistory tracks painTier inferred
- Andy review monthly first 6 months
- V2 : ML-based inference if data sufficient

### Risk R5 — Migration retroactive data
**Severity** : Low  
**Risk** : 597 existing contacts have no ICP Score initial  
**Mitigation** : 
- Run `/api/scoring/recalculate-all` once post-deploy
- Will compute ICP from existing fields (group, persona, etc.)
- Intent Score = signals from last 90 days (decay applied)
- Some contacts will fall to Monitor (no signals) → acceptable

---

## 10. Implementation timeline

```
Semaine 1 (lundi 18 → vendredi 22 mai):
  Sprint 3a — Schema + Config foundation
  → Deploy prod fin de semaine
  
Semaine 2 (25 → 29 mai):
  Sprint 3b — Compute engine
  → Tests verts, code prêt
  
Semaine 3 (1 → 5 juin):
  Sprint 3c — Priority Level + Pain Tier + Negative signals
  → Recalculate all existing accounts
  
Semaine 4 (8 → 12 juin):
  Sprint 3d — Triggers + Orchestration + Intent Feed integration
  → Deploy prod, monitor 2 semaines
  
Semaine 5-6 (15-30 juin):
  Monitoring + tuning weights/thresholds
  Drafter PRD-005 Apify+n8n + PRD-006 Apollo switch
```

→ **Total : 4 semaines focus + 2 semaines tuning** = ~6 semaines pour scoring engine pleinement opérationnel.

---

## 11. Sprint prompts ready-to-paste

### Sprint 3a — Prompt Claude Code

```
Sprint Phase 3 Scoring Engine — Foundation (Sprint 3a, ~1 semaine).

CONTEXTE :
Andy a livré le reference doc "Oxen OS Priority Scoring Engine v2" (May 2026).
PRD-004 drafted. Sprint Trigify Phase 2A + Intent Feed V1 livré 15 mai.
Sprint 3a = schema + config foundation pour scoring engine.

OBJECTIF SPRINT 3a :
- Tables Prisma : ScoringConfig (JSONB versioned) + ScoreHistory
- Extensions CrmContact, IntentSignal, SignalTypeRegistry
- Seed initial ScoringConfig v1 avec toutes valeurs du doc Andy
- Backfill Cat A-I sur SignalTypeRegistry existing codes
- Config loader + Zod validation lib
- ~30 tests new

PRÉ-REQUIS LECTURE :
- reference/PRD_004_PHASE3_SCORING.md (this doc)
- Andy's reference document "Oxen OS Priority Scoring Engine v2"
- prisma/schema.prisma (existing IntentSignal + SignalTypeRegistry)
- src/lib/crm-config.ts (LIFECYCLE_STAGES extended)

[... detailed batches B1-B5 as per §4.3 ...]

STOP avant push, montrer:
- Diff complet
- Output tests + build + lint
- Confirmation commit local
```

### Sprint 3b, 3c, 3d prompts à drafter après livraison du Sprint précédent (avec recon).

---

## 12. References

### Source documents
- **Andy Reference Doc** : "Oxen OS Priority Scoring Engine v2" (May 2026)
- `reference/PRD_001_MAPPING.md` v3.7 — Group routing G1-G7B
- `reference/PRD_002_TRIGIFY_PRESPEC.md` v1.2 — Trigify Phase 2A
- `reference/PRD_003_INTENT_FEED.md` v1.1 — Intent Feed V1
- `reference/OXEN_OS_ROADMAP_OVERVIEW.md` — Master roadmap

### Code patterns to reuse
- `src/app/api/webhooks/trigify/route.ts` — API route pattern (Phase 2A)
- `src/lib/trigify-matching.ts` — Account matching pattern
- `src/lib/telegram.ts` — notifyEmployee helper
- `src/lib/intent-feed/proxy-score.ts` — Will be replaced by real Priority Score
- `src/lib/crm-config.ts` — LIFECYCLE_STAGES + extensions
- Existing decay cron — reference for daily batch

### External
- Andy Reference Doc (source of truth specs)
- Lemlist API documentation (for sequence orchestration)

---

## 13. Future PRDs (out of scope this PRD)

### PRD-005 — Apify + n8n source pipeline
- Categories C (Public banking frustration), D (Competitive), E (Regulatory), F (Financial), I (Indirect social)
- n8n routing pattern
- Apify scraping setup
- Cost estimation
- Estimated effort : ~2 semaines

### PRD-006 — Apollo switch from Clay
- Migration data Clay → Apollo
- New webhook /api/webhooks/apollo
- Categories F (Financial), G (Recruitment via PredictLeads)
- New lead enrichment for /api/signals
- Estimated effort : ~1-2 semaines

### PRD-007 — Oxen website analytics integration
- Category A signals (pricing page visit, demo page, etc.)
- Plausible/PostHog/custom analytics
- Cookie tracking + identification
- Estimated effort : ~1 semaine

### PRD-008 — Market-wide signals + campaigns
- Market signal types (competitor moves, regulatory)
- Campaign trigger system
- Draft status workflow
- Collision rules (avoid double-messaging)
- Estimated effort : ~1-2 semaines

### PRD-009 — Admin UI configuration
- Full admin interface for tuning
- Structural changes UI (add/remove categories)
- Scoring version comparison analytics
- Estimated effort : ~2-3 semaines

---

## Changelog

- **v1.0** (2026-05-15 evening) — initial pre-spec based on Andy's reference document. 4 sub-sprints découpés, ~4 semaines focus. Hors scope = source pipelines (PRDs séparés 005-007), admin UI (PRD-009), market signals (PRD-008). V1 marche avec sources actuelles (Cat H Trigify + Cat B Lemlist + Cat E/F/G from Clay legacy).
