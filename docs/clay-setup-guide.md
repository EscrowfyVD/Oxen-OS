# Clay HTTP API — Configuration guide for Duy

> **Audience** : Duy Cao (freelance Clay).
> **Purpose** : configure Clay Tables to push enriched rows directly into Oxen OS CRM via the `/api/webhooks/clay-enrichment` endpoint.
> **Generated** : 2026-05-05 (Sprint S0 batch 5).

---

## 1. Pipeline overview

```
Apollo Enrichment → Clay Tables (per G+T) → HTTP API column → Oxen OS CRM
                                              │
                                              ▼
                            POST https://os.oxen.finance
                                /api/webhooks/clay-enrichment
                                              │
                                              ▼
                              Auto-upsert: Company by domain,
                              Contact by email (idempotent)
```

Two delivery modes are supported. This guide covers **Mode B (HTTP API push)**. For one-off CSV imports, use the in-app wizard (`docs/clay-csv-import-guide.md`).

---

## 2. Prerequisites

- **Clay plan with HTTP API column enabled** (gated feature — verify with Andy or Vernon if not visible).
- **Webhook secret** : ask Vernon for the value of `CLAY_WEBHOOK_SECRET`. Same secret is used for both the legacy intent-signal webhook (`/api/webhooks/clay`) and the new enrichment endpoint (`/api/webhooks/clay-enrichment`).
- **Naming convention compliance** : every Clay table must follow `vDC_{group}_Tier {tier}_{scope}_{filter}` — see Section 6.

---

## 3. Step-by-step Clay column configuration

For each Clay table that should auto-push to Oxen :

1. Add an HTTP API column at the end of the table (right after the last enrichment column so the row is "complete" before push).
2. **Method** : `POST`
3. **URL** : `https://os.oxen.finance/api/webhooks/clay-enrichment`
4. **Headers** :
   ```
   x-webhook-secret: <CLAY_WEBHOOK_SECRET>
   Content-Type: application/json
   ```
5. **Body template** (mapping Clay columns to schema — see Section 4 for full templates).
6. **Trigger** : "Run when row complete" (i.e. all enrichment columns populated). Avoid "Run on edit" to prevent duplicate writes.

---

## 4. Body templates

### 4.1 Company table (`vDC_*_Company_*`)

```json
{
  "source_table": "vDC_G1_Tier 1_Company_Active Business Loss",
  "scope": "company",
  "group": "G1",
  "pain_tier": "T1",
  "company": {
    "name": "{{ Name }}",
    "description": "{{ Description }}",
    "primaryIndustry": "{{ Primary Industry }}",
    "size": "{{ Size }}",
    "type": "{{ Type }}",
    "location": "{{ Location }}",
    "country": "{{ Country }}",
    "domain": "{{ Domain }}",
    "linkedinUrl": "{{ LinkedIn URL }}"
  }
}
```

**Required fields** : `source_table`, `scope`, `group`, `pain_tier`, `company.name`, `company.domain`. All others are optional.

### 4.2 People table (`vDC_*_People_*`)

```json
{
  "source_table": "vDC_G1_Tier 1_People_Active Business Loss",
  "scope": "people",
  "group": "G1",
  "pain_tier": "T1",
  "person": {
    "firstName": "{{ First Name }}",
    "lastName": "{{ Last Name }}",
    "fullName": "{{ Full Name }}",
    "jobTitle": "{{ Job Title }}",
    "email": "{{ Email }}",
    "emailValidationStatus": "{{ Email Validation Status }}",
    "emailProvider": "{{ Email Provider }}",
    "linkedinUrl": "{{ LinkedIn URL (Person) }}",
    "location": "{{ Location (Person) }}",
    "country": "{{ Country (Person) }}",
    "company": {
      "name": "{{ Company Name }}",
      "domain": "{{ Company Domain }}",
      "linkedinUrl": "{{ Company LinkedIn }}"
    }
  }
}
```

**Required fields** : `source_table`, `scope`, `group`, `pain_tier`, `person.email`. If `person.company` is provided, `person.company.domain` is required (used for Company auto-creation/match).

---

## 5. Pilot test workflow

Before enabling the HTTP column on the full table :

1. **Hardcode the body** with one known Clay row (e.g. MidChains for the Company test, Jean-Philippe Chetcuti for the People test).
2. **Run the column manually** on a single row.
3. **Expected response** : `200 OK` + JSON body :
   ```json
   { "success": true, "action": "created", "companyId": "co_xxx" }
   ```
   (or `"action": "updated"` on subsequent re-pushes).
4. **Verify in Oxen** : `/crm/contacts` (for People scope) or `/crm/companies` (for Company scope) — the new record should appear immediately, tagged with the correct `group` + `painTier` + `clayTableSegment`.
5. Once the pilot row is correctly upserted, enable the column for the full table.

### 5.1 Common error responses

| HTTP | Body | Cause |
|---|---|---|
| 401 | `{ "error": "Missing webhook secret" }` | `x-webhook-secret` header not sent |
| 401 | `{ "error": "Invalid webhook secret" }` | Header value does not match `CLAY_WEBHOOK_SECRET` |
| 400 | `{ "error": "Invalid input" }` | Zod validation failed — check required fields, types, enum values for `scope`/`group`/`pain_tier` |
| 500 | `{ "success": false, "error": "..." }` | Server-side issue — capture and forward to Vernon |

---

## 6. Naming convention for new tables

All Clay tables that push to Oxen **must** follow this exact format :

```
vDC_{group}_Tier {tier}_{scope}_{filter}
```

| Component | Allowed values | Example |
|---|---|---|
| `vDC_` | literal prefix | — |
| `{group}` | `G1`, `G2`, `G3`, `G4`, `G5`, `G6`, `G7A`, `G7B` | `G1` |
| `Tier ` | literal (note the space after Tier) | — |
| `{tier}` | `1`, `2`, `3` | `1` |
| `_{scope}_` | `Company` or `People` (capitalized) | `Company` |
| `{filter}` | free-text segment description (e.g. "Active Business Loss") | `Active Business Loss` |

Examples :
- `vDC_G1_Tier 1_Company_Active Business Loss` ✅
- `vDC_G7B_Tier 2_People_Crypto Funds Series A` ✅
- `Clay_Companies_2026` ❌ (does not match — Oxen wizard auto-detection will fail)

The Oxen webhook does **not** parse the table name to derive `group`/`pain_tier` — those are sent explicitly in the JSON body. But the in-app CSV wizard relies on the convention to auto-detect, so consistency matters.

---

## 7. Schema reference

The Oxen endpoint validates payloads against a Zod schema (`clayEnrichmentSchema` in `src/app/api/webhooks/_schemas.ts`). Field-level details :

### Top-level
- `source_table` : string, max 200 chars
- `scope` : `"company"` | `"people"`
- `group` : enum `G1`..`G7B`
- `pain_tier` : enum `T1`..`T3`

### `company` sub-object (required when `scope="company"`)
- `name` : 1-255 chars (required)
- `domain` : 1-255 chars (required, lowercased server-side)
- `description` : ≤ 2000 chars (optional)
- `primaryIndustry` : ≤ 255 chars (optional)
- `size` : ≤ 50 chars (optional)
- `type` : ≤ 50 chars (optional)
- `location` : ≤ 255 chars (optional)
- `country` : ≤ 100 chars (optional)
- `linkedinUrl` : valid URL ≤ 500 chars (optional)

### `person` sub-object (required when `scope="people"`)
- `email` : valid email ≤ 320 chars (required, lowercased server-side)
- `firstName`, `lastName`, `fullName` : each ≤ 100/255 chars (optional)
- `jobTitle` : ≤ 255 chars — **drives DM/OP persona auto-classification** (see Section 8)
- `emailValidationStatus` : enum `"valid"` | `"invalid"` | `"risky"` | `"unknown"` (optional)
- `emailProvider` : ≤ 50 chars (optional)
- `linkedinUrl`, `location`, `country` : optional
- `company` : optional sub-object — if present, `company.domain` is required (1-255 chars)

---

## 8. Server-side processing (what Oxen does after receiving a payload)

| Step | Action |
|---|---|
| Auth | Verify `x-webhook-secret` via `timingSafeEqual` (`src/lib/webhook-auth.ts`) |
| Validate | Zod parse against `clayEnrichmentSchema` |
| Dispatch | `scope=company` → `upsertCompanyFromClay()` ; `scope=people` → `upsertPersonFromClay()` |
| Idempotency | Company match by `domain` (lowercased) ; Contact match by `email` (lowercased) |
| Persona | New contacts: `classifyPersona(jobTitle)` → DM if title contains any of: ceo, founder, owner, managing director, chief, president, partner, director ; else OP ; null if jobTitle empty |
| BD assignment | New contacts only: `assignRandomBD()` → 50/50 Andy/Paul Louis ; existing contacts preserve `dealOwner` |
| Mapping note | Clay `primaryIndustry` → Oxen `industry` field (intentional — see PRD_001_MAPPING.md C1 decision) |

---

## 9. Troubleshooting

- **Persistent 401** : confirm with Vernon that the secret you have matches the `CLAY_WEBHOOK_SECRET` Railway env var (the secret is rotated on incident, not periodic).
- **Persistent 400 with no detail** : the production endpoint uses `publicErrors: false` to avoid leaking schema structure to attackers. To see detailed Zod errors, ask Vernon to temporarily flip the flag in `src/app/api/webhooks/clay-enrichment/route.ts` line ~38 for a debugging session.
- **Successful 200 but record missing in Oxen** : check `clayTableSegment` parsing — the segment is auto-extracted from `source_table`. If your filter contains underscores after the scope marker, the regex captures everything past the last `_Company_` or `_People_`. If unsure, query DB :
  ```sql
  SELECT id, name, domain, "clayTableSegment", "group", "painTier"
  FROM "Company"
  WHERE domain = '<your-domain>';
  ```

---

## 10. Reference

- Endpoint code : `src/app/api/webhooks/clay-enrichment/route.ts`
- Validation schema : `src/app/api/webhooks/_schemas.ts` (`clayEnrichmentSchema`)
- Upsert helpers (single source of truth) : `src/lib/clay-enrichment.ts`
- Decision history : `CLAY_ENRICHMENT_PAYLOAD_DRAFT.md` v1.1 + `PRD_001_MAPPING.md` v3.3
- Sprint S0 implementation log : commits 2f6195c, 2c9984b, b801a71, 35270b0, plus this batch
