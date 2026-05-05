# Clay Enrichment Pipeline — Spec technique
# Sprint S0 — Endpoint /api/webhooks/clay-enrichment + CSV import wizard étendu

> Document préparé par Vernon le 2026-05-05 (v1.1)
> v1 : draft initial avec 3 décisions ouvertes
> v1.1 : 3 décisions tranchées par Vernon (D1 keywords OK, D2 drop seeds, D3 tag)
> Statut : prêt pour implémentation Sprint S0 (Vernon + Claude Code)

---

## 1. Contexte

Andy a engagé Duy Cao (freelance Clay) pour construire un pipeline d'enrichissement Apollo → Clay Tables. Aujourd'hui :

- **2 tables Clay actives** :
  - `vDC_G1_Tier 1_Company_Active Business Loss` — 1 711 companies enrichies
  - `vDC_G1_Tier 1_People_Active Business Loss` — 981 people enrichis (100% complété)
- **23 autres combinaisons** (G+T) à créer progressivement
- **Naming convention** : `vDC_{group}_Tier {tier}_{scope}_{filter}` où :
  - `group` ∈ {G1, G2, G3, G4, G5, G6, G7A, G7B}
  - `tier` ∈ {1, 2, 3}
  - `scope` ∈ {Company, People}
  - `filter` = description du segment (ex: "Active Business Loss")

**Décision architecture** : `group` et `pain_tier` sont **encodés dans le nom de la table source**, pas dans une colonne row. Toutes les rows d'une table = même G+T par construction.

## 2. Architecture du pipeline

```
Apollo Enrichment → Clay Tables (par G+T) → ??? → Oxen DB
                                            ↑
                                  Pipeline à construire
```

**Deux modes supportés** :

### Mode A — CSV Import (immédiat, manuel)

```
Clay Table → Export CSV → Upload Oxen UI → /api/crm/contacts/import-clay
```

**Use case** : seed initial des 2 692 rows existantes, ou fallback si Clay HTTP API indisponible.

### Mode B — HTTP API push (futur, automatique)

```
Clay Table → HTTP API column → POST /api/webhooks/clay-enrichment → Oxen DB
```

**Use case** : nouvelles rows enrichies en temps réel, pour les futures tables G+T.

**Convergence** : les deux modes appellent au final la même logique d'upsert côté Oxen.

---

## 3. Schema du payload

### 3.1 Payload Company

```json
{
  "source_table": "vDC_G1_Tier 1_Company_Active Business Loss",
  "scope": "company",
  "group": "G1",
  "pain_tier": "T1",
  "company": {
    "name": "MidChains",
    "description": "By changing the way people...",
    "primaryIndustry": "Financial Services",
    "size": "11-50 employees",
    "type": "Privately Held",
    "location": "Abu Dhabi, Maryah Island",
    "country": "United Arab Emirates",
    "domain": "midchains.com",
    "linkedinUrl": "https://www.linkedin.com/..."
  }
}
```

**Champs requis** : `source_table`, `scope`, `group`, `pain_tier`, `company.name`, `company.domain`.

**Champs optionnels** : tous les autres.

### 3.2 Payload People

```json
{
  "source_table": "vDC_G1_Tier 1_People_Active Business Loss",
  "scope": "people",
  "group": "G1",
  "pain_tier": "T1",
  "person": {
    "firstName": "Jean-Philippe",
    "lastName": "Chetcuti",
    "fullName": "Jean-Philippe Chetcuti",
    "jobTitle": "Director",
    "email": "jpc@inter-serv.com",
    "emailValidationStatus": "valid",
    "emailProvider": "Hunter",
    "linkedinUrl": "https://www.linkedin.com/...",
    "location": "Valletta, Malta",
    "country": "Malta",
    "company": {
      "name": "INTERSERV | Corporate Services",
      "domain": "inter-serv.com",
      "linkedinUrl": "https://www.linkedin.com/..."
    }
  }
}
```

**Champs requis** : `source_table`, `scope`, `group`, `pain_tier`, `person.email`, `person.company.domain`.

**Champs optionnels** : tous les autres.

### 3.3 Validation Zod (côté Oxen)

```typescript
// src/app/api/webhooks/_schemas.ts (ajout)

export const clayEnrichmentSchema = z.object({
  source_table: z.string().min(1).max(200),
  scope: z.enum(["company", "people"]),
  group: z.enum(["G1", "G2", "G3", "G4", "G5", "G6", "G7A", "G7B"]),
  pain_tier: z.enum(["T1", "T2", "T3"]),
  company: z.object({
    name: z.string().min(1).max(255),
    description: z.string().max(2000).optional(),
    primaryIndustry: z.string().max(255).optional(),
    size: z.string().max(50).optional(),
    type: z.string().max(50).optional(),
    location: z.string().max(255).optional(),
    country: z.string().max(100).optional(),
    domain: z.string().max(255),
    linkedinUrl: z.string().url().max(500).optional(),
  }).optional(),
  person: z.object({
    firstName: z.string().max(100).optional(),
    lastName: z.string().max(100).optional(),
    fullName: z.string().max(255).optional(),
    jobTitle: z.string().max(255).optional(),
    email: z.string().email().max(320),
    emailValidationStatus: z.enum(["valid", "invalid", "risky", "unknown"]).optional(),
    emailProvider: z.string().max(50).optional(),
    linkedinUrl: z.string().url().max(500).optional(),
    location: z.string().max(255).optional(),
    country: z.string().max(100).optional(),
    company: z.object({
      name: z.string().max(255).optional(),
      domain: z.string().max(255),
      linkedinUrl: z.string().url().max(500).optional(),
    }).optional(),
  }).optional(),
});
```

**Règle de validation** :
- `scope: "company"` → `company` requis, `person` ignoré
- `scope: "people"` → `person` requis, `company` optionnel (créé si absent)

---

## 4. Endpoint `/api/webhooks/clay-enrichment`

### 4.1 Spec

```
POST /api/webhooks/clay-enrichment
Headers:
  Authorization: Bearer ${CLAY_WEBHOOK_SECRET}
Body: clayEnrichmentSchema (cf. 3.3)

Response 200:
  { 
    success: true, 
    action: "created" | "updated" | "skipped",
    contactId?: string,
    companyId?: string 
  }

Response 401: missing/invalid webhook secret
Response 400: validation error
Response 500: internal error (logged + Sentry)
```

### 4.2 Logique du handler

```typescript
// Pseudo-code

export async function POST(req: Request) {
  // 1. Auth
  await requireWebhookSecret({ envVarName: "CLAY_WEBHOOK_SECRET" });
  
  // 2. Validate
  const data = await validateBody(clayEnrichmentSchema);
  
  // 3. Dispatch by scope
  if (data.scope === "company") {
    return upsertCompany(data);
  } else {
    return upsertPerson(data);
  }
}

async function upsertCompany(data) {
  // Match by domain (lowercase)
  const existing = await prisma.company.findFirst({
    where: { domain: { equals: data.company.domain.toLowerCase() } }
  });
  
  const fields = {
    name: data.company.name,
    description: data.company.description,
    primaryIndustry: data.company.primaryIndustry,
    companySize: data.company.size,
    companyType: data.company.type,
    location: data.company.location,
    country: data.company.country,
    domain: data.company.domain.toLowerCase(),
    linkedinUrl: data.company.linkedinUrl,
    group: data.group,
    painTier: data.pain_tier,
    enrichmentSource: "clay",
    enrichedAt: new Date(),
  };
  
  if (existing) {
    await prisma.company.update({ 
      where: { id: existing.id }, 
      data: fields 
    });
    return { success: true, action: "updated", companyId: existing.id };
  } else {
    const created = await prisma.company.create({ data: fields });
    return { success: true, action: "created", companyId: created.id };
  }
}

async function upsertPerson(data) {
  // Step 1 — Match or create the Company
  let companyId = null;
  if (data.person.company?.domain) {
    const company = await upsertCompanyMinimal(data.person.company, data.group, data.pain_tier);
    companyId = company.id;
  }
  
  // Step 2 — Match Contact by email (lowercase)
  const existing = await prisma.crmContact.findFirst({
    where: { email: { equals: data.person.email.toLowerCase() } }
  });
  
  const fields = {
    firstName: data.person.firstName,
    lastName: data.person.lastName,
    email: data.person.email.toLowerCase(),
    jobTitle: data.person.jobTitle,
    linkedinUrl: data.person.linkedinUrl,
    location: data.person.location,
    country: data.person.country,
    companyId: companyId,
    group: data.group,
    painTier: data.pain_tier,
    persona: classifyPersona(data.person.jobTitle), // DM ou OP via job title
    enrichmentSource: "clay",
    enrichedAt: new Date(),
    // Auto-assignment: random 50/50 Andy/Paul Louis (cf. PRD-001 décision Andy)
    dealOwnerId: existing?.dealOwnerId ?? assignRandomBD(),
  };
  
  if (existing) {
    await prisma.crmContact.update({ 
      where: { id: existing.id }, 
      data: fields 
    });
    return { success: true, action: "updated", contactId: existing.id };
  } else {
    const created = await prisma.crmContact.create({ data: fields });
    return { success: true, action: "created", contactId: created.id };
  }
}

function classifyPersona(jobTitle?: string): "DM" | "OP" | null {
  if (!jobTitle) return null;
  const dm = ["ceo", "founder", "owner", "managing director", "chief", "president", "partner", "director"];
  const lowered = jobTitle.toLowerCase();
  if (dm.some(t => lowered.includes(t))) return "DM";
  return "OP";
}
```

### 4.3 Idempotency

- **Match Company par `domain.toLowerCase()`** : pas de doublon
- **Match Person par `email.toLowerCase()`** : pas de doublon
- **Re-push d'une row déjà en DB** : update silencieux (pas d'erreur, action = "updated")

### 4.4 Édge cases

| Cas | Comportement |
|---|---|
| `scope: "people"` mais email manquant | 400 validation error |
| `scope: "company"` mais domain manquant | 400 validation error |
| Person sans company associée | Person créée avec `companyId: null` |
| Company name conflit (même domain, name différent) | Update vers le nouveau name (Clay = source de vérité) |
| Group invalide (ex: "G9") | 400 validation error (Zod) |

---

## 5. CSV Import wizard étendu

### 5.1 Workflow utilisateur

```
1. Andy/Vernon ouvre Oxen → /crm/contacts → "Import CSV"
2. Upload fichier CSV exporté de Clay
3. Wizard demande : "Quelle table source ?" → user sélectionne dans dropdown 
   (preset values: vDC_G1_Tier 1_Company, vDC_G1_Tier 1_People, etc.)
4. Wizard auto-détecte scope + group + pain_tier depuis le nom de table
5. Wizard mappe les colonnes CSV → champs Oxen (UI mapping classique)
6. Validation preview : N contacts à créer, M à updater, X errors
7. Confirmer import → batch process → POST /api/webhooks/clay-enrichment 
   pour chaque row, en interne
8. Affichage résultat : created / updated / skipped / errored
```

### 5.2 Modifs à apporter à `/api/crm/contacts/import`

**Champs CSV à ajouter au mapping** :
- `companyDescription`
- `primaryIndustry`
- `companySize`
- `companyType`
- `companyDomain` ← critique pour matching
- `companyLinkedinUrl`
- `companyCountry`
- `companyLocation`
- `personLinkedinUrl`
- `personLocation`
- `personCountry`
- `emailValidationStatus`
- `emailProvider`

**Logique** : à l'import, le wizard appelle l'endpoint `/api/webhooks/clay-enrichment` pour chaque row plutôt que l'ancienne logique d'import direct. Cohérence garantie.

### 5.3 Spec UI

```
┌─────────────────────────────────────────────────────┐
│  Import contacts depuis Clay                        │
├─────────────────────────────────────────────────────┤
│                                                     │
│  📄 Drop CSV file here / Browse                    │
│                                                     │
│  Source table: [Dropdown: select source table]     │
│    └── vDC_G1_Tier 1_Company_Active Business Loss  │
│    └── vDC_G1_Tier 1_People_Active Business Loss   │
│    └── + Custom (manual entry)                      │
│                                                     │
│  ✓ Auto-detected: scope=company, group=G1, T=T1     │
│                                                     │
│  Column mapping:                                    │
│    Name           → company.name                    │
│    Domain         → company.domain                  │
│    Country        → company.country                 │
│    Size           → company.size                    │
│    [...]                                            │
│                                                     │
│  Preview: 1,711 rows detected                       │
│           1,650 will be created                     │
│              45 will be updated (existing domain)   │
│              16 errors (missing domain)             │
│                                                     │
│  [ Cancel ]              [ Confirm Import ]         │
└─────────────────────────────────────────────────────┘
```

---

## 6. Modifs schema Prisma requises

### 6.1 Nouveau enum

```prisma
enum CrmGroup {
  G1
  G2
  G3
  G4
  G5
  G6
  G7A
  G7B
}

enum CrmPainTier {
  T1
  T2
  T3
}

enum CrmPersona {
  DM
  OP
}

enum EnrichmentSource {
  clay
  trigify
  manual
  csv_import
  inbound_form
}
```

### 6.2 Champs ajoutés sur Company

```prisma
model Company {
  // ... champs existants
  
  // Clay enrichment
  description       String?     @db.Text
  primaryIndustry   String?
  companySize       String?     // "11-50 employees", "51-200 employees", etc.
  companyType       String?     // "Privately Held", "Public Company", etc.
  location          String?
  country           String?
  domain            String?     @unique  // CRITICAL: unique pour idempotency
  linkedinUrl       String?
  
  // Clay segment tag (D3)
  clayTableSegment  String?     // ex: "Active Business Loss", extrait du nom de table
  
  // PRD-001 scoring
  group             CrmGroup?
  painTier          CrmPainTier?
  
  // Tracking
  enrichmentSource  EnrichmentSource?
  enrichedAt        DateTime?
}
```

### 6.3 Champs ajoutés sur CrmContact

```prisma
model CrmContact {
  // ... champs existants (incluant icpFit, icpScore, etc. déjà présents)
  
  // Clay enrichment
  location          String?
  country           String?  // ⚠️ Existe peut-être déjà — vérifier
  
  // PRD-001 scoring
  group             CrmGroup?
  painTier          CrmPainTier?
  persona           CrmPersona?
  
  // Tracking
  enrichmentSource  EnrichmentSource?
  enrichedAt        DateTime?
}
```

**Note** : Vérifier ce qui existe déjà sur CrmContact pour éviter doublons. `linkedinUrl`, `companyId` existent probablement déjà.

### 6.4 Migration

```bash
npx prisma migrate dev --name add_clay_enrichment_fields
```

**Backfill** : aucun (DB vide en pratique, 9 contacts seeds n'ont pas ces champs).

---

## 7. Configuration côté Clay (Mode B — HTTP API)

### 7.1 Setup colonne HTTP API par table

Sur chaque table Clay (commencer par People, puis Company) :

1. Click **+ Add column** → **Add enrichment** → **HTTP API**
2. Configuration :
   - **Method**: `POST`
   - **URL**: `https://os.oxen.finance/api/webhooks/clay-enrichment`
   - **Headers**: 
     ```
     Authorization: Bearer ${CLAY_WEBHOOK_SECRET}
     Content-Type: application/json
     ```
   - **Body**: JSON template avec mapping colonnes Clay → schema (cf. section 3)
3. **Trigger**: "Run when row complete" (toutes les colonnes enrichies)
4. **Save** + Auto-run

### 7.2 Variable env requise

```
# .env (Railway)
CLAY_WEBHOOK_SECRET=<secret partagé Clay ↔ Oxen>
```

À générer (32 chars random hex) et ajouter côté Clay (header) + côté Railway (env var).

---

## 8. Plan de roll-out

### Phase 1 — Sprint S0 (cette semaine)

- [x] Décisions D1, D2, D3 tranchées (Vernon 2026-05-05) ✅
- [ ] Migration Prisma (enums + champs Company/CrmContact + clayTableSegment)
- [ ] Endpoint `/api/webhooks/clay-enrichment` avec validation Zod
- [ ] Helper `classifyPersona()` avec keywords D1
- [ ] Helper `extractSegment()` pour parsing source_table (D3)
- [ ] DROP des 9 seeds (D2) avant seed Clay
- [ ] Tests unitaires (10+ cases)
- [ ] CSV import wizard étendu (+ champs companySize, country, etc.)

### Phase 2 — Seed initial (Sprint S0 fin / S1 début)

- [ ] Export CSV depuis Clay table Company → import dans Oxen (1 711 rows)
- [ ] Export CSV depuis Clay table People → import dans Oxen (981 rows)
- [ ] Vérification DB : ~1 700 companies + ~980 contacts en G1/T1
- [ ] Vernon valide manuellement 5-10 contacts pour QA

### Phase 3 — HTTP API push (Sprint S1)

- [ ] Upgrade Clay au plan qui débloque HTTP API
- [ ] Configuration colonne HTTP API sur table People G1/T1 (pilote)
- [ ] Test push 1 row → vérif Oxen
- [ ] Roll-out HTTP API sur table Company G1/T1
- [ ] Documentation pour Duy : process de configuration HTTP API pour les futures tables

### Phase 4 — Extension G+T (Sprint S1+ progressivement)

- [ ] Duy crée `vDC_G1_Tier 2_*`, `vDC_G2_Tier 1_*`, etc. progressivement
- [ ] Chaque nouvelle table = colonne HTTP API préconfigurée (template)
- [ ] Andy lance les sequences Lemlist correspondantes (G1-T1-DM, G1-T1-OP, etc.)

---

## 9. Risques & mitigation

| # | Risque | Impact | Mitigation |
|---|---|---|---|
| R1 | Clay HTTP API quota dépassé | Push interrompus | Monitoring + queue Oxen-side pour replay |
| R2 | Email duplicates entre tables Clay (même person dans G1 T1 et G1 T2) | Conflits | Match par email primary key, dernier write wins |
| R3 | `domain` sur Company pas garantie unique côté Clay | Doublons Companies | Constraint UNIQUE sur `Company.domain` côté Prisma |
| R4 | Person sans Company info (Clay row partiellement enrichie) | Contact créé sans company | Accepté, `companyId: null`, à enrichir plus tard |
| R5 | Andy renomme une table Clay (ex: G1 → G2 par erreur) | Mauvais classification | Validation côté Oxen : refuser si group dans `source_table` ne match pas le param `group` |
| R6 | CSV import volumineux (1 711 rows) timeout | Import partiel | Batch processing par chunks de 100, idempotent (replay safe) |
| R7 | Persona classification heuristique imparfaite | Mauvais routing DM/OP | Andy peut override manuellement dans UI Oxen, ML possible plus tard |

---

## 10. Décisions tranchées (Vernon 2026-05-05)

### D1 — Auto-classification persona ✅

Heuristique retenue (validée 2026-05-05) :
- **DM** si jobTitle contient (case-insensitive) : `ceo`, `founder`, `owner`, `managing director`, `chief`, `president`, `partner`, `director`
- **OP** sinon

À implémenter dans `classifyPersona(jobTitle)` côté endpoint.

### D2 — Drop 9 seeds existants ✅

Décision : **DROP** les 9 CrmContacts test seeds avant import Clay (clean slate).

Action Sprint S0 :
```sql
-- À exécuter avant le seed Clay
DELETE FROM "CrmContact";
-- Vérifier
SELECT COUNT(*) FROM "CrmContact"; -- doit être 0
```

### D3 — Filtre "Active Business Loss" du nom de table ✅

Décision : **TAG** — stocker dans un nouveau champ `Company.clayTableSegment String?`.

Logique de parsing :
```typescript
// Extract segment from source_table
// Input: "vDC_G1_Tier 1_Company_Active Business Loss"
// Output: "Active Business Loss"
function extractSegment(sourceTable: string): string | null {
  const match = sourceTable.match(/_(?:Company|People)_(.+)$/);
  return match ? match[1] : null;
}
```

Stockage : `Company.clayTableSegment = "Active Business Loss"` (ou autre selon table).

Use case : permet de filtrer dans Oxen UI "show me companies from Active Business Loss segment" pour reporting Andy.

---

## 11. Checklist Sprint S0

- [ ] Décisions D1, D2, D3 tranchées (Vernon + Andy)
- [ ] Migration Prisma écrite et testée
- [ ] Endpoint `/api/webhooks/clay-enrichment` codé
- [ ] Tests unitaires (10+ cases)
- [ ] CSV import wizard étendu
- [ ] Documentation API exposée (pour Duy : URL, secret, payload schema)
- [ ] Variable `CLAY_WEBHOOK_SECRET` générée + ajoutée Railway
- [ ] Test end-to-end : 1 row Clay (CSV) → import Oxen → CrmContact créé en G1/T1
- [ ] Test idempotency : re-import même CSV → 0 doublons

---

## 12. Contacts

- **Vernon Dessy** (founder) — décisions architecture
- **Andy** (Head of Sales) — décisions métier (mapping G+T, persona rules)
- **Duy Cao** (freelance Clay) — configuration côté Clay (CSV export, HTTP API setup)
- **Johnny Le** (dev externe) — implémentation côté Oxen

---

*Fin du document — CLAY_ENRICHMENT_PAYLOAD_DRAFT v1 (2026-05-05)*
