"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import Papa from "papaparse"
import ExcelJS from "exceljs"

/* ── Design Tokens ── */
const CARD_BG = "var(--card-bg)"
const CARD_BORDER = "var(--card-border)"
const TEXT = "var(--text-primary)"
const TEXT2 = "var(--text-secondary)"
const TEXT3 = "var(--text-tertiary)"
const ROSE = "var(--rose-gold)"
const GREEN = "var(--green)"
const AMBER = "var(--amber)"
const RED = "var(--red)"
const GLASS: React.CSSProperties = {
  background: CARD_BG,
  border: `1px solid ${CARD_BORDER}`,
  borderRadius: 14,
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  boxShadow: "0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px var(--surface-hover)",
}

/* ── CRM Field Options ── */
const CRM_FIELDS = [
  { value: "", label: "-- Skip --" },
  { value: "firstName", label: "First Name" },
  { value: "lastName", label: "Last Name" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "jobTitle", label: "Job Title" },
  { value: "companyName", label: "Company" },
  { value: "linkedinUrl", label: "LinkedIn URL" },
  { value: "notes", label: "Notes" },
  { value: "vertical", label: "Vertical (auto-detects sub-vertical)" },
  { value: "subVertical", label: "Sub-Vertical" },
  { value: "geoZone", label: "Geo Zone" },
  { value: "dealOwner", label: "Deal Owner" },
  { value: "lifecycleStage", label: "Lifecycle Stage" },
  { value: "acquisitionSource", label: "Acquisition Source" },
  { value: "acquisitionSourceDetail", label: "Acquisition Detail" },
  { value: "outreachGroup", label: "Outreach Group" },
  { value: "dealValue", label: "Deal Value" },
  { value: "contactType", label: "Contact Type" },
]

/* ── Auto-Mapping ── */
const AUTO_MAP: Record<string, string> = {
  "firstname": "firstName",
  "first_name": "firstName",
  "first name": "firstName",
  "lastname": "lastName",
  "last_name": "lastName",
  "last name": "lastName",
  "favoriteemail": "email",
  "favorite email": "email",
  "email": "email",
  "e-mail": "email",
  "jobtitle": "jobTitle",
  "job title": "jobTitle",
  "job_title": "jobTitle",
  "title": "jobTitle",
  "companies": "companyName",
  "company": "companyName",
  "company name": "companyName",
  "company_name": "companyName",
  "favoritephone": "phone",
  "phone": "phone",
  "phone number": "phone",
  "favoriteurl": "linkedinUrl",
  "linkedin": "linkedinUrl",
  "linkedin url": "linkedinUrl",
  "linkedin_url": "linkedinUrl",
  "website": "linkedinUrl",
  "url": "linkedinUrl",
  "description": "notes",
  "notes": "notes",
  "note": "notes",
  "vertical": "vertical",
  "status": "lifecycleStage",
  "stage": "lifecycleStage",
  "lifecycle stage": "lifecycleStage",
  "lifecycle_stage": "lifecycleStage",
  "prospect owner": "dealOwner",
  "owner": "dealOwner",
  "deal_owner": "dealOwner",
  "deal owner": "dealOwner",
  "assigned to": "dealOwner",
  "deal value": "dealValue",
  "deal_value": "dealValue",
  "value": "dealValue",
  "amount": "dealValue",
  "channel": "acquisitionSource",
  "source": "acquisitionSource",
  "acquisition source": "acquisitionSource",
  "place of meeting": "acquisitionSourceDetail",
  "groups": "outreachGroup",
  "group": "outreachGroup",
  "type": "contactType",
  "contact type": "contactType",
  "geo": "geoZone",
  "geo zone": "geoZone",
  "geo_zone": "geoZone",
  "region": "geoZone",
  "company vertical": "vertical",
  "sub-vertical": "subVertical",
  "sub vertical": "subVertical",
  "subvertical": "subVertical",
  "sub_vertical": "subVertical",
}

/* ── Value Mappers ── */
function mapVertical(raw: string): string[] {
  const lower = raw.toLowerCase()
  if (lower.includes("csp") || lower.includes("fiduciar")) return ["CSP / Fiduciaries"]
  if (lower.includes("crypto") || lower.includes("fintech") || lower.includes("blockchain")) return ["FinTech / Crypto"]
  if (lower.includes("family office") || lower.includes("mfo")) return ["Family Office"]
  if (lower.includes("gaming") || lower.includes("igaming")) return ["iGaming"]
  if (lower.includes("yacht")) return ["Yacht Brokers"]
  if (lower.includes("luxury") || lower.includes("art broker") || lower.includes("private jet") || lower.includes("concierge") || lower.includes("real estate")) return ["Luxury Assets"]
  if (lower.includes("import") || lower.includes("export") || lower.includes("trade") || lower.includes("freight") || lower.includes("commodity")) return ["Import / Export"]
  // Sub-vertical keywords → parent vertical
  if (lower.includes("legal") || lower.includes("lawyer") || lower.includes("law firm") || lower.includes("tax")) return ["CSP / Fiduciaries"]
  if (lower.includes("wealth") || lower.includes("trust") || lower.includes("asset manag") || lower.includes("fund manag")) return ["Family Office"]
  if (lower.includes("rbi") || lower.includes("cbi") || lower.includes("residence by invest") || lower.includes("citizen")) return ["CSP / Fiduciaries"]
  if (lower.includes("relocation")) return ["CSP / Fiduciaries"]
  return [raw]
}

function mapSubVertical(raw: string): string[] {
  const lower = raw.toLowerCase()
  if (lower.includes("tax lawyer") || lower.includes("tax advisor")) return ["Tax Lawyers"]
  if (lower.includes("corporate lawyer") || lower.includes("corporate law")) return ["Corporate Lawyers"]
  if (lower.includes("m&a") || lower.includes("mergers")) return ["M&A Lawyers"]
  if (lower.includes("immigration lawyer") || lower.includes("immigration law")) return ["Immigration Lawyers"]
  if (lower.includes("international contract")) return ["International Contracts Lawyers"]
  if (lower.includes("rbi") || lower.includes("residence by invest")) return ["RBI Specialists"]
  if (lower.includes("cbi") || lower.includes("citizen")) return ["CBI Specialists"]
  if (lower.includes("wealth manag")) return ["Wealth Managers"]
  if (lower.includes("trust")) return ["Trustees / Trust Companies"]
  if (lower.includes("corporate service") && !lower.includes("lawyer")) return ["Corporate Service Providers (CSPs)"]
  if (lower.includes("management comp")) return ["Management Companies"]
  if (lower.includes("asset manag")) return ["Asset Managers"]
  if (lower.includes("fund manag")) return ["Fund Managers"]
  if (lower.includes("crypto fund")) return ["Crypto Funds"]
  if (lower.includes("crypto account")) return ["Crypto Accountants"]
  if (lower.includes("crypto tax")) return ["Crypto Tax Advisors"]
  if (lower.includes("crypto") && lower.includes("csp")) return ["Crypto Company Services Providers"]
  if (lower.includes("family office") || lower.includes("mfo")) return ["Multi-Family Offices (MFO)"]
  if (lower.includes("real estate")) return ["Real Estate Brokers"]
  if (lower.includes("yacht broker")) return ["Yacht Brokers"]
  if (lower.includes("art broker")) return ["Art Brokers"]
  if (lower.includes("private jet")) return ["Private Jets Brokers"]
  if (lower.includes("concierge")) return ["Luxury Concierges"]
  if (lower.includes("relocation")) return ["Relocation Agencies"]
  if (lower.includes("igaming oper")) return ["iGaming Operators"]
  if (lower.includes("igaming plat")) return ["iGaming Platform Providers"]
  if (lower.includes("freight") || lower.includes("logistics")) return ["Freight / Logistics Brokers"]
  if (lower.includes("commodity")) return ["Commodity Traders"]
  // Generic "legal" / "lawyer" → default sub-vertical
  if (lower.includes("legal") || lower.includes("lawyer") || lower.includes("law firm")) return ["Corporate Lawyers"]
  if (lower.includes("tax")) return ["Tax Lawyers"]
  return []
}

function mapLifecycleStage(raw: string): string {
  const lower = raw.toLowerCase()
  if (lower.includes("lead") || lower === "new") return "new_lead"
  if (lower.includes("qualif")) return "replied"
  if (lower.includes("meeting")) return "meeting_booked"
  if (lower.includes("proposal")) return "proposal_sent"
  if (lower.includes("negot")) return "negotiation"
  if (lower.includes("won") || lower.includes("client")) return "closed_won"
  if (lower.includes("lost")) return "closed_lost"
  return "new_lead"
}

function mapDealOwner(raw: string): string {
  const lower = raw.toLowerCase()
  if (lower.includes("andy")) return "Andy"
  if (lower.includes("paul")) return "Paul Louis"
  if (lower.includes("vernon")) return "Vernon"
  return raw
}

function mapAcquisitionSource(raw: string): string {
  const lower = raw.toLowerCase()
  if (lower.includes("outbound") || lower.includes("clay")) return "Clay / Outbound Sequence"
  if (lower.includes("conference") || lower.includes("event")) return "Conference"
  if (lower.includes("inbound") || lower.includes("website")) return "Inbound / Website"
  if (lower.includes("linkedin")) return "LinkedIn / DM"
  if (lower.includes("referral")) return "Referral / Introducer"
  return raw
}

/* ── Stage Labels for Preview ── */
const STAGE_LABELS: Record<string, string> = {
  new_lead: "New Lead",
  sequence_active: "Sequence Active",
  replied: "Replied",
  meeting_booked: "Meeting Booked",
  meeting_completed: "Meeting Completed",
  proposal_sent: "Proposal Sent",
  negotiation: "Negotiation",
  closed_won: "Closed Won",
  closed_lost: "Closed Lost",
}

/* ── Types ── */
interface CsvImportWizardProps {
  onClose: () => void
  onComplete: () => void
}

interface MappedContact {
  firstName: string
  lastName: string
  email: string
  phone?: string
  jobTitle?: string
  companyName?: string
  linkedinUrl?: string
  notes?: string
  vertical?: string[]
  subVertical?: string[]
  geoZone?: string
  dealOwner?: string
  lifecycleStage?: string
  acquisitionSource?: string
  acquisitionSourceDetail?: string
  outreachGroup?: string
  dealValue?: number
  contactType?: string
}

interface ImportResult {
  imported: number
  updated: number
  skipped: number
  errors: Array<{ email: string; reason: string }>
}

const STEPS = ["Upload", "Map Columns", "Preview", "Import"]

/* ══════════════════════════════════════════════════════════════
   CSV IMPORT WIZARD
   ══════════════════════════════════════════════════════════════ */
export default function CsvImportWizard({ onClose, onComplete }: CsvImportWizardProps) {
  const [step, setStep] = useState(0)
  const [fileName, setFileName] = useState("")
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<string[][]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [duplicateAction, setDuplicateAction] = useState<"skip" | "update">("skip")
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [existingDbEmails, setExistingDbEmails] = useState<Set<string>>(new Set())
  const [checkingDuplicates, setCheckingDuplicates] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  /* ── Check existing DB duplicates when entering preview ── */
  useEffect(() => {
    if (step !== 2) return
    const mapped = buildMappedContacts()
    const emails = mapped.filter((c) => c.email).map((c) => c.email.toLowerCase())
    if (emails.length === 0) return

    setCheckingDuplicates(true)
    fetch("/api/crm/contacts/check-duplicates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emails }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.existing) setExistingDbEmails(new Set(data.existing as string[]))
      })
      .catch(() => {})
      .finally(() => setCheckingDuplicates(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  /* ── Auto-map helper ── */
  const applyAutoMap = useCallback((hdrs: string[], rws: string[][]) => {
    setHeaders(hdrs)
    setRows(rws)
    const autoMapping: Record<string, string> = {}
    hdrs.forEach((h) => {
      const key = h.trim().toLowerCase()
      if (AUTO_MAP[key]) autoMapping[h] = AUTO_MAP[key]
    })
    setMapping(autoMapping)
    setStep(1)
  }, [])

  /* ── Parse CSV ── */
  const parseCsv = useCallback((file: File) => {
    Papa.parse(file, {
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data as string[][]
        if (data.length < 2) return
        applyAutoMap(data[0], data.slice(1))
      },
    })
  }, [applyAutoMap])

  /* ── Parse XLSX ── */
  const parseXlsx = useCallback(async (file: File) => {
    const buffer = await file.arrayBuffer()
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer)
    const sheet = workbook.worksheets[0]
    if (!sheet || sheet.rowCount < 2) return

    const hdrs: string[] = []
    const rws: string[][] = []

    sheet.eachRow((row, rowNum) => {
      const cells = row.values as (string | number | boolean | null | undefined)[]
      // ExcelJS row.values is 1-indexed (index 0 is undefined)
      const vals = cells.slice(1).map((v) => (v != null ? String(v) : ""))
      if (rowNum === 1) {
        hdrs.push(...vals)
      } else {
        rws.push(vals)
      }
    })

    if (hdrs.length === 0) return
    applyAutoMap(hdrs, rws)
  }, [applyAutoMap])

  /* ── Handle file (CSV or XLSX) ── */
  const handleFile = useCallback((file: File) => {
    const ext = file.name.toLowerCase()
    if (!ext.endsWith(".csv") && !ext.endsWith(".xlsx") && !ext.endsWith(".xls")) return
    setFileName(file.name)
    if (ext.endsWith(".csv")) {
      parseCsv(file)
    } else {
      parseXlsx(file)
    }
  }, [parseCsv, parseXlsx])

  /* ── Build mapped contacts from raw data ── */
  const buildMappedContacts = useCallback((): MappedContact[] => {
    return rows.map((row) => {
      const contact: Record<string, unknown> = {}
      headers.forEach((header, idx) => {
        const field = mapping[header]
        if (!field) return
        const val = (row[idx] || "").trim()
        if (!val) return

        switch (field) {
          case "vertical": {
            contact.vertical = mapVertical(val)
            const subs = mapSubVertical(val)
            if (subs.length > 0) contact.subVertical = subs
            break
          }
          case "subVertical":
            contact.subVertical = mapSubVertical(val)
            break
          case "linkedinUrl":
            // Only set as LinkedIn URL if value actually contains "linkedin"
            if (val.toLowerCase().includes("linkedin")) {
              contact.linkedinUrl = val
            }
            break
          case "lifecycleStage":
            contact.lifecycleStage = mapLifecycleStage(val)
            break
          case "dealOwner":
            contact.dealOwner = mapDealOwner(val)
            break
          case "acquisitionSource":
            contact.acquisitionSource = mapAcquisitionSource(val)
            break
          case "dealValue": {
            const num = parseFloat(val.replace(/[^0-9.-]/g, ""))
            if (!isNaN(num)) contact.dealValue = num
            break
          }
          default:
            contact[field] = val
        }
      })
      return contact as unknown as MappedContact
    })
  }, [rows, headers, mapping])

  /* ── Import ── */
  const handleImport = useCallback(async () => {
    setImporting(true)
    setProgress(10)

    const allContacts = buildMappedContacts()
    // Filter out contacts without email
    const contactsToImport = allContacts.filter((c) => c.email)

    setProgress(30)

    try {
      const res = await fetch("/api/crm/contacts/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contacts: contactsToImport,
          duplicateAction,
        }),
      })

      setProgress(90)

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: "Import failed" }))
        setResult({
          imported: 0,
          updated: 0,
          skipped: 0,
          errors: [{ email: "N/A", reason: errData.error || "Import failed" }],
        })
      } else {
        const data = await res.json()
        setResult(data)
      }
    } catch {
      setResult({
        imported: 0,
        updated: 0,
        skipped: 0,
        errors: [{ email: "N/A", reason: "Network error during import" }],
      })
    }

    setProgress(100)
    setImporting(false)
    setStep(3)
  }, [buildMappedContacts, duplicateAction])

  /* ── Preview Data ── */
  const previewContacts = step === 2 ? buildMappedContacts() : []
  const validContacts = previewContacts.filter((c) => c.email)
  const skippedNoEmail = previewContacts.filter((c) => !c.email)
  const emailsSeen = new Set<string>()
  const duplicateEmails = new Set<string>()
  validContacts.forEach((c) => {
    const e = c.email.toLowerCase()
    if (emailsSeen.has(e)) duplicateEmails.add(e)
    emailsSeen.add(e)
  })

  /* ── Styles ── */
  const overlayStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: 9999,
    background: "rgba(0,0,0,0.75)",
    backdropFilter: "blur(8px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  }

  const modalStyle: React.CSSProperties = {
    ...GLASS,
    width: "min(96vw, 900px)",
    minHeight: "min(600px, 85vh)",
    maxHeight: "92vh",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    color: "var(--text-primary)",
  }

  const headerStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "20px 28px 16px",
    borderBottom: `1px solid ${CARD_BORDER}`,
  }

  const bodyStyle: React.CSSProperties = {
    flex: 1,
    overflowY: "auto",
    padding: "24px 28px",
  }

  const footerStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 28px",
    borderTop: `1px solid ${CARD_BORDER}`,
  }

  const btnBase: React.CSSProperties = {
    padding: "8px 20px",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    fontFamily: "'DM Sans', sans-serif",
    cursor: "pointer",
    border: "none",
    transition: "opacity 0.15s",
  }

  const btnPrimary: React.CSSProperties = {
    ...btnBase,
    background: `linear-gradient(135deg, ${ROSE}, #A07070)`,
    color: "#fff",
  }

  const btnSecondary: React.CSSProperties = {
    ...btnBase,
    background: "var(--card-border)",
    color: TEXT2,
    border: `1px solid ${CARD_BORDER}`,
  }

  const selectStyle: React.CSSProperties = {
    background: "var(--card-border)",
    border: `1px solid ${CARD_BORDER}`,
    borderRadius: 8,
    color: TEXT,
    padding: "7px 10px",
    fontSize: 12,
    fontFamily: "'DM Sans', sans-serif",
    width: "100%",
  }

  /* ── Step Indicator ── */
  const renderStepIndicator = () => (
    <div style={{ display: "flex", alignItems: "center", gap: 0, flex: 1, justifyContent: "center" }}>
      {STEPS.map((label, i) => (
        <div key={label} style={{ display: "flex", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontWeight: 700,
                fontFamily: "'DM Sans', sans-serif",
                background: i <= step ? ROSE : "var(--card-border)",
                color: i <= step ? "#fff" : TEXT3,
                transition: "all 0.2s",
              }}
            >
              {i < step ? "\u2713" : i + 1}
            </div>
            <span
              style={{
                fontSize: 13,
                fontFamily: "'DM Sans', sans-serif",
                color: i === step ? TEXT : TEXT3,
                fontWeight: i === step ? 600 : 400,
              }}
            >
              {label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              style={{
                width: 48,
                height: 1,
                background: i < step ? ROSE : CARD_BORDER,
                margin: "0 16px",
              }}
            />
          )}
        </div>
      ))}
    </div>
  )

  /* ═════════════════════════════════════════════════════
     STEP 1 — Upload
     ═════════════════════════════════════════════════════ */
  const renderUpload = () => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        flex: 1,
        minHeight: 400,
        gap: 24,
      }}
    >
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          const file = e.dataTransfer.files[0]
          if (file) handleFile(file)
        }}
        style={{
          width: "100%",
          maxWidth: 560,
          border: `2px dashed ${dragOver ? ROSE : CARD_BORDER}`,
          borderRadius: 20,
          padding: "80px 48px",
          textAlign: "center",
          background: dragOver ? "var(--rose-glow)" : "var(--surface-subtle)",
          transition: "all 0.2s",
          cursor: "pointer",
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        <div style={{ fontSize: 56, marginBottom: 20, opacity: 0.5 }}>
          {"\u2B06\uFE0F"}
        </div>
        <p
          style={{
            fontFamily: "'Bellfair', serif",
            fontSize: 22,
            color: TEXT,
            margin: "0 0 10px",
          }}
        >
          Drop your CSV or Excel file here
        </p>
        <p
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 13,
            color: TEXT3,
            margin: 0,
          }}
        >
          Supports .csv, .xlsx, and .xls files
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
        }}
      />

      <button
        onClick={() => fileInputRef.current?.click()}
        style={btnPrimary}
      >
        Choose CSV or Excel File
      </button>
    </div>
  )

  /* ═════════════════════════════════════════════════════
     STEP 2 — Column Mapping
     ═════════════════════════════════════════════════════ */
  const renderMapping = () => {
    const sampleRows = rows.slice(0, 3)

    return (
      <div>
        <p
          style={{
            fontFamily: "'Bellfair', serif",
            fontSize: 18,
            color: TEXT,
            margin: "0 0 4px",
          }}
        >
          Map Columns to CRM Fields
        </p>
        <p
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 12,
            color: TEXT3,
            margin: "0 0 20px",
          }}
        >
          {fileName} -- {rows.length} row{rows.length !== 1 ? "s" : ""} detected
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 2fr",
            gap: "1px",
            background: CARD_BORDER,
            borderRadius: 10,
            overflow: "hidden",
          }}
        >
          {/* Header Row */}
          <div
            style={{
              padding: "10px 14px",
              fontSize: 10,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: 0.8,
              color: TEXT3,
              fontFamily: "'DM Sans', sans-serif",
              background: "var(--card-bg-solid)",
            }}
          >
            CSV Column
          </div>
          <div
            style={{
              padding: "10px 14px",
              fontSize: 10,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: 0.8,
              color: TEXT3,
              fontFamily: "'DM Sans', sans-serif",
              background: "var(--card-bg-solid)",
            }}
          >
            CRM Field
          </div>
          <div
            style={{
              padding: "10px 14px",
              fontSize: 10,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: 0.8,
              color: TEXT3,
              fontFamily: "'DM Sans', sans-serif",
              background: "var(--card-bg-solid)",
            }}
          >
            Sample Data
          </div>

          {/* Mapping Rows */}
          {headers.map((header, hIdx) => (
            <div key={header} style={{ display: "contents" }}>
              <div
                style={{
                  padding: "12px 14px",
                  fontSize: 13,
                  color: mapping[header] ? TEXT : TEXT2,
                  fontFamily: "'DM Sans', sans-serif",
                  fontWeight: mapping[header] ? 500 : 400,
                  background: CARD_BG,
                  display: "flex",
                  alignItems: "center",
                }}
              >
                {header}
              </div>
              <div
                style={{
                  padding: "8px 10px",
                  background: CARD_BG,
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <select
                  value={mapping[header] || ""}
                  onChange={(e) =>
                    setMapping((m) => ({ ...m, [header]: e.target.value }))
                  }
                  style={selectStyle}
                >
                  {CRM_FIELDS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
              <div
                style={{
                  padding: "8px 14px",
                  background: CARD_BG,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                {sampleRows.map((row, rIdx) => (
                  <span
                    key={rIdx}
                    style={{
                      display: "inline-block",
                      padding: "2px 8px",
                      fontSize: 11,
                      color: TEXT2,
                      fontFamily: "'DM Sans', sans-serif",
                      background: "var(--surface-elevated)",
                      borderRadius: 4,
                      maxWidth: 180,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {row[hIdx] || "--"}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  /* ═════════════════════════════════════════════════════
     STEP 3 — Preview
     ═════════════════════════════════════════════════════ */
  const renderPreview = () => {
    const previewThStyle: React.CSSProperties = {
      padding: "10px 12px",
      textAlign: "left",
      fontSize: 10,
      color: TEXT3,
      textTransform: "uppercase",
      letterSpacing: 0.8,
      fontWeight: 600,
      fontFamily: "'DM Sans', sans-serif",
      whiteSpace: "nowrap",
      borderBottom: `1px solid ${CARD_BORDER}`,
      position: "sticky" as const,
      top: 0,
      background: "var(--card-bg-solid)",
      zIndex: 1,
    }

    const previewTdStyle: React.CSSProperties = {
      padding: "8px 12px",
      fontSize: 12,
      fontFamily: "'DM Sans', sans-serif",
      borderBottom: `1px solid ${CARD_BORDER}`,
      color: TEXT,
      whiteSpace: "nowrap",
      maxWidth: 180,
      overflow: "hidden",
      textOverflow: "ellipsis",
    }

    return (
      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 16,
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <p
              style={{
                fontFamily: "'Bellfair', serif",
                fontSize: 18,
                color: TEXT,
                margin: "0 0 4px",
              }}
            >
              Preview Import
            </p>
            <div
              style={{
                display: "flex",
                gap: 16,
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 12,
              }}
            >
              <span style={{ color: GREEN }}>
                {validContacts.length - duplicateEmails.size} to import
              </span>
              {duplicateEmails.size > 0 && (
                <span style={{ color: AMBER }}>
                  {duplicateEmails.size} CSV duplicate{duplicateEmails.size !== 1 ? "s" : ""}
                </span>
              )}
              {existingDbEmails.size > 0 && (
                <span style={{ color: AMBER }}>
                  {existingDbEmails.size} already in CRM
                </span>
              )}
              {skippedNoEmail.length > 0 && (
                <span style={{ color: RED }}>
                  {skippedNoEmail.length} skipped (no email)
                </span>
              )}
              {checkingDuplicates && (
                <span style={{ color: TEXT3 }}>
                  Checking duplicates...
                </span>
              )}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 12,
              color: TEXT2,
            }}
          >
            <span>When duplicate found:</span>
            <select
              value={duplicateAction}
              onChange={(e) =>
                setDuplicateAction(e.target.value as "skip" | "update")
              }
              style={{
                ...selectStyle,
                width: "auto",
                minWidth: 120,
              }}
            >
              <option value="skip">Skip</option>
              <option value="update">Update existing</option>
            </select>
          </div>
        </div>

        <div
          style={{
            ...GLASS,
            overflow: "hidden",
            maxHeight: 400,
          }}
        >
          <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: 400 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={previewThStyle}>Status</th>
                  <th style={previewThStyle}>Name</th>
                  <th style={previewThStyle}>Email</th>
                  <th style={previewThStyle}>Company</th>
                  <th style={previewThStyle}>Vertical</th>
                  <th style={previewThStyle}>Sub-Vertical</th>
                  <th style={previewThStyle}>Stage</th>
                  <th style={previewThStyle}>Owner</th>
                  <th style={previewThStyle}>Deal Value</th>
                </tr>
              </thead>
              <tbody>
                {previewContacts.map((c, i) => {
                  const hasEmail = !!c.email
                  const isDup = hasEmail && duplicateEmails.has(c.email.toLowerCase())
                  const isDbDup = hasEmail && existingDbEmails.has(c.email.toLowerCase())
                  const rowBg = !hasEmail
                    ? "rgba(248,113,113,0.04)"
                    : isDup || isDbDup
                    ? "rgba(251,191,36,0.04)"
                    : "transparent"

                  return (
                    <tr key={i} style={{ background: rowBg }}>
                      <td style={previewTdStyle}>
                        {!hasEmail ? (
                          <span
                            title="No email - will be skipped"
                            style={{
                              color: RED,
                              fontSize: 14,
                              cursor: "help",
                            }}
                          >
                            {"\u2717"}
                          </span>
                        ) : isDbDup ? (
                          <span
                            title={`Already exists in CRM — will ${duplicateAction}`}
                            style={{
                              color: AMBER,
                              fontSize: 14,
                              cursor: "help",
                            }}
                          >
                            {"\uD83D\uDD04"}
                          </span>
                        ) : isDup ? (
                          <span
                            title="Duplicate email in CSV"
                            style={{
                              color: AMBER,
                              fontSize: 14,
                              cursor: "help",
                            }}
                          >
                            {"\u26A0"}
                          </span>
                        ) : (
                          <span
                            style={{
                              color: GREEN,
                              fontSize: 14,
                            }}
                          >
                            {"\u2713"}
                          </span>
                        )}
                      </td>
                      <td style={previewTdStyle}>
                        {c.firstName || ""} {c.lastName || ""}
                      </td>
                      <td style={{ ...previewTdStyle, color: hasEmail ? TEXT2 : RED }}>
                        {c.email || "Missing"}
                      </td>
                      <td style={{ ...previewTdStyle, color: TEXT2 }}>
                        {c.companyName || "--"}
                      </td>
                      <td style={{ ...previewTdStyle, color: TEXT2 }}>
                        {c.vertical?.join(", ") || "--"}
                      </td>
                      <td style={{ ...previewTdStyle, color: TEXT2, fontSize: 11 }}>
                        {c.subVertical?.join(", ") || "--"}
                      </td>
                      <td style={previewTdStyle}>
                        {c.lifecycleStage ? (
                          <span
                            style={{
                              display: "inline-block",
                              padding: "2px 8px",
                              fontSize: 10,
                              fontWeight: 500,
                              borderRadius: 16,
                              background: "var(--rose-dim)",
                              color: ROSE,
                            }}
                          >
                            {STAGE_LABELS[c.lifecycleStage] || c.lifecycleStage}
                          </span>
                        ) : (
                          <span style={{ color: TEXT3 }}>--</span>
                        )}
                      </td>
                      <td style={{ ...previewTdStyle, color: TEXT2 }}>
                        {c.dealOwner || "--"}
                      </td>
                      <td style={{ ...previewTdStyle, color: TEXT2 }}>
                        {c.dealValue
                          ? `\u20AC${c.dealValue.toLocaleString()}`
                          : "--"}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  /* ═════════════════════════════════════════════════════
     STEP 4 — Import Progress & Results
     ═════════════════════════════════════════════════════ */
  const renderResults = () => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 340,
        gap: 24,
      }}
    >
      {/* Progress Bar */}
      <div style={{ width: "100%", maxWidth: 480 }}>
        <div
          style={{
            width: "100%",
            height: 8,
            background: "var(--card-border)",
            borderRadius: 4,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${progress}%`,
              height: "100%",
              background: `linear-gradient(90deg, ${ROSE}, ${GREEN})`,
              borderRadius: 4,
              transition: "width 0.5s ease",
            }}
          />
        </div>
        <p
          style={{
            textAlign: "center",
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 12,
            color: TEXT3,
            marginTop: 8,
          }}
        >
          {importing ? "Importing contacts..." : `${progress}% complete`}
        </p>
      </div>

      {/* Results */}
      {result && !importing && (
        <div
          style={{
            ...GLASS,
            padding: "28px 36px",
            width: "100%",
            maxWidth: 480,
          }}
        >
          <p
            style={{
              fontFamily: "'Bellfair', serif",
              fontSize: 20,
              color: TEXT,
              margin: "0 0 20px",
              textAlign: "center",
            }}
          >
            Import Complete
          </p>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 14,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ color: GREEN, fontSize: 16 }}>{"\u2705"}</span>
              <span style={{ color: TEXT }}>
                Imported: <strong>{result.imported}</strong> contacts
              </span>
            </div>

            {result.updated > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ color: AMBER, fontSize: 16 }}>{"\uD83D\uDD04"}</span>
                <span style={{ color: TEXT }}>
                  Updated: <strong>{result.updated}</strong> existing
                </span>
              </div>
            )}

            {result.skipped > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ color: TEXT3, fontSize: 16 }}>{"\u23ED\uFE0F"}</span>
                <span style={{ color: TEXT }}>
                  Skipped: <strong>{result.skipped}</strong> contacts
                </span>
              </div>
            )}

            {result.errors.length > 0 && (
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    marginBottom: 8,
                  }}
                >
                  <span style={{ color: RED, fontSize: 16 }}>{"\u274C"}</span>
                  <span style={{ color: RED }}>
                    Errors: <strong>{result.errors.length}</strong>
                  </span>
                </div>
                <div
                  style={{
                    maxHeight: 120,
                    overflowY: "auto",
                    background: "rgba(248,113,113,0.06)",
                    borderRadius: 8,
                    padding: "8px 12px",
                  }}
                >
                  {result.errors.map((err, i) => (
                    <p
                      key={i}
                      style={{
                        fontSize: 11,
                        color: TEXT2,
                        margin: "4px 0",
                        fontFamily: "'DM Sans', sans-serif",
                      }}
                    >
                      <span style={{ color: RED }}>{err.email}</span>:{" "}
                      {err.reason}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => {
              onComplete()
              onClose()
            }}
            style={{
              ...btnPrimary,
              width: "100%",
              marginTop: 24,
              padding: "10px 20px",
            }}
          >
            Done
          </button>
        </div>
      )}
    </div>
  )

  /* ═════════════════════════════════════════════════════
     RENDER
     ═════════════════════════════════════════════════════ */
  return (
    <div style={overlayStyle} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={modalStyle}>
        {/* Header */}
        <div style={headerStyle}>
          {renderStepIndicator()}
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: TEXT3,
              fontSize: 20,
              cursor: "pointer",
              padding: "4px 8px",
              lineHeight: 1,
              borderRadius: 6,
              transition: "color 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = TEXT)}
            onMouseLeave={(e) => (e.currentTarget.style.color = TEXT3)}
            title="Cancel"
          >
            {"\u2715"}
          </button>
        </div>

        {/* Body */}
        <div style={bodyStyle}>
          {step === 0 && renderUpload()}
          {step === 1 && renderMapping()}
          {step === 2 && renderPreview()}
          {step === 3 && renderResults()}
        </div>

        {/* Footer */}
        {step > 0 && step < 3 && (
          <div style={footerStyle}>
            <button
              onClick={() => setStep((s) => s - 1)}
              style={btnSecondary}
            >
              Back
            </button>

            {step === 1 && (
              <button
                onClick={() => setStep(2)}
                style={btnPrimary}
              >
                Next
              </button>
            )}

            {step === 2 && (
              <button
                onClick={handleImport}
                disabled={importing || validContacts.length === 0}
                style={{
                  ...btnPrimary,
                  opacity: importing || validContacts.length === 0 ? 0.5 : 1,
                  cursor:
                    importing || validContacts.length === 0
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                {importing
                  ? "Importing..."
                  : `Import ${validContacts.length} Contact${validContacts.length !== 1 ? "s" : ""}`}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
