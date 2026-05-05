# Clay CSV Import — User guide for Andy

> **Audience** : Andy (Head of Sales).
> **Purpose** : import enriched contacts from Clay tables into Oxen OS via the in-app CSV wizard. Use this for the **initial seed** (~2 692 rows from the existing G1-T1 Company + People tables) and for any follow-up batches before Mode B HTTP push is wired.
> **Generated** : 2026-05-05 (Sprint S0 batch 5).

---

## 1. When to use this

| Use case | Use this guide ? |
|---|---|
| Seed initial data from existing Clay tables (G1-T1 Company + People) | ✅ |
| Re-run import after a Clay enrichment refresh (data refreshed in same table) | ✅ (idempotent — re-imports update without duplicates) |
| Push a single newly enriched row in real time | ❌ — wait for Mode B (HTTP API column, see `clay-setup-guide.md`) |
| Import non-Clay data (Folk CRM, manual list) | ❌ — use the standard "Import" button (different wizard) |

---

## 2. Step-by-step workflow

### Step A — Export the Clay table to CSV

In Clay :
1. Open the table you want to import (e.g. `vDC_G1_Tier 1_Company_Active Business Loss`).
2. Click "Export" → "CSV" (or equivalent — UI may vary by Clay version).
3. Download the CSV. **Note the exact table name** — you'll select it in Oxen.

### Step B — Open the import wizard in Oxen

1. Go to `https://os.oxen.finance/crm/contacts` (login via Google `@oxen.finance`).
2. Top-right buttons row : click **"Import (Clay)"** (the Clay-specific button, not the generic "Import" one).

### Step C — Step 1 of wizard : Upload CSV

The modal shows a drop zone. Either :
- Drag-and-drop the CSV file onto the zone, or
- Click the zone to open a file picker.

The wizard parses the file (using `papaparse`) and shows you `N rows, M columns` once loaded. Click "Next" implicitly happens — you advance to Step 2 automatically.

### Step D — Step 2 of wizard : Select source table

You see two options :

#### Option 1 : Preset
A dropdown with the 2 currently configured tables :
- `vDC_G1_Tier 1_Company_Active Business Loss`
- `vDC_G1_Tier 1_People_Active Business Loss`

Pick the one that matches the CSV you uploaded. The preset list will grow as Duy adds new G+T tables.

#### Option 2 : Custom (manual entry)
For tables not yet in the preset list. Type the **exact** table name following the convention :
```
vDC_{group}_Tier {tier}_{scope}_{filter}
```

Example : `vDC_G2_Tier 1_Company_Recent Fundraise`

#### Auto-detection panel
Below the input, you'll see a green check :
```
✓ Auto-detected: scope=company, group=G1, tier=T1, segment="Active Business Loss"
```

If it shows a red `✗ Cannot parse table name`, the format is wrong — fix the table name. The "Next: Map columns" button stays disabled until detection succeeds.

### Step E — Step 3 of wizard : Map columns

For each column in your CSV, the wizard shows a dropdown of Oxen schema fields. Most columns are auto-mapped :

| CSV header (case-insensitive) | Auto-mapped to (Company scope) | Auto-mapped to (People scope) |
|---|---|---|
| `Name`, `Company Name` | `name` | (n/a — separate first/last) |
| `Domain`, `Company Domain` | `domain` | `company.domain` |
| `Description` | `description` | — |
| `Industry`, `Primary Industry` | `primaryIndustry` | — |
| `Size`, `Company Size` | `size` | — |
| `Type` | `type` | — |
| `Country` | `country` | `country` |
| `Location` | `location` | `location` |
| `LinkedIn URL`, `LinkedIn` | `linkedinUrl` | `linkedinUrl` |
| `Email` | — | `email` |
| `First Name`, `Firstname` | — | `firstName` |
| `Last Name`, `Lastname` | — | `lastName` |
| `Job Title`, `Title` | — | `jobTitle` |
| `Email Validation`, `Email Validation Status` | — | `emailValidationStatus` |
| `Email Provider` | — | `emailProvider` |

**Review and adjust** if the auto-mapping is off. Set unwanted columns to `-- Skip --`.

**Required fields** :
- For Company scope : `name` and `domain` must be mapped.
- For People scope : `email` must be mapped.

If a required field has no mapping, the import will fail those rows (counted in `errored`).

### Step F — Step 4 of wizard : Preview

Recap : `Ready to import N rows (scope) tagged as G1-T1`. Click **"Confirm Import"**.

### Step G — Step 5 of wizard : Result

After import (~5-30 seconds for 1 000-2 000 rows) :

```
✅ Import complete: 1650 created, 45 updated, 16 errors out of 1711 rows.
```

If there are errors, click "Show first N errors" to see details (row index + error message). Common errors documented in Section 4.

Click "Close" to dismiss the modal — the contacts list refreshes automatically.

---

## 3. Idempotency — re-imports are safe

Each row is upserted using a **natural key** :
- **Company scope** : the `domain` field (lowercased).
- **People scope** : the `email` field (lowercased).

If you re-import the same CSV (or a refreshed export of the same Clay table), existing rows are **updated in place** — no duplicates created. Specifically :

- Companies : all fields refreshed (description, industry, size, etc.).
- Contacts : all fields refreshed except **`dealOwner`** which is preserved from the first import (re-enrichment must not reassign).

Result counter on re-import : you'll see lots of `updated: N` and few `created: 0` — this is normal and expected.

---

## 4. Common errors

| Error message | Meaning | Fix |
|---|---|---|
| `Required` (on `domain` or `email`) | Required field missing in that row | Check CSV — was the column mapped ? Is the cell empty ? |
| `Invalid email` | Email format invalid in CSV | Clean CSV (run validator before re-import) |
| `Invalid input` (no detail) | Zod validation failed | Likely an enum mismatch (`group`, `pain_tier`, `emailValidationStatus`). Check spelling. |
| `Invalid scope or missing company payload` | Source table parsed as `scope=company` but row has no company fields | Mapping mismatch — verify mapping at Step 3 |
| `Forbidden` (on submit) | You don't have CRM access | Ask Vernon to grant `crm` page access on your Employee record |

---

## 5. Limits

| Limit | Value | Reason |
|---|---|---|
| Max rows per import | 5 000 | Schema validation cap |
| Max errors returned in response | 100 | Avoid huge JSON responses ; remaining errors logged server-side |
| Chunk size (server-side processing) | 100 rows | Promise.allSettled batch — failures isolated per chunk |

For tables larger than 5 000 rows : split the CSV (Excel : Filter + Export selection, or `split -l 5000 file.csv chunk_`) and import in multiple passes.

---

## 6. Tips & best practices

- **Always test with a small CSV first** (e.g. 5 rows) when configuring a new Clay table — catches mapping issues before running a 2 000-row batch.
- **Date format** : not currently parsed (Oxen sets `enrichedAt = now()` server-side). Don't worry about Clay's date columns.
- **Empty cells** : safe — they translate to `undefined` and Oxen skips them (does not overwrite existing data with empty values).
- **CSV with BOM / UTF-16 / Windows-1252** : Papa Parse auto-detects encoding. If you see garbled accents in the preview, re-export from Clay choosing UTF-8.
- **Errors during import** : the wizard does NOT roll back successful rows — partial imports leave already-processed rows in the DB. Rerun the same CSV after fixing errors — idempotency makes this safe.

---

## 7. Reference

- Backend endpoint : `POST /api/crm/contacts/import-clay` (auth : `requirePageAccess("crm")`)
- Frontend component : `src/components/crm/ClayImportWizard.tsx`
- Source-table parser : `src/lib/clay-enrichment.ts:parseClayTableName()`
- Single-source-of-truth upsert helpers : `src/lib/clay-enrichment.ts:upsertCompanyFromClay()` / `upsertPersonFromClay()`
- For technical deep-dive, see also `docs/clay-setup-guide.md` (HTTP API config for Duy).
