"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import {
  STAGE_COLORS, STAGE_LABELS, LIFECYCLE_STAGES,
  VERTICALS, SUB_VERTICALS, GEO_ZONES, DEAL_OWNERS,
  OWNER_COLORS, CRM_COLORS,
  OUTREACH_GROUPS, ACQUISITION_SOURCES,
  ICP_FITS, RELATIONSHIP_STRENGTHS,
  CONTACT_TYPES,
  getOwnerForGeo,
} from "@/lib/crm-config"

/* ── Design Tokens ── */
const CARD_BORDER = CRM_COLORS.card_border
const TEXT = CRM_COLORS.text_primary
const TEXT2 = CRM_COLORS.text_secondary
const TEXT3 = CRM_COLORS.text_tertiary
const ROSE = CRM_COLORS.rose_gold
const EDIT_BORDER = "rgba(91,155,191,0.7)"
const FONT = "'DM Sans', sans-serif"

/* ══════════════════════════════════════════════
   TYPES
   ══════════════════════════════════════════════ */
export interface TableContact {
  id: string
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  linkedinUrl: string | null
  jobTitle: string | null
  company: { id: string; name: string; website?: string | null } | null
  companyId: string | null
  lifecycleStage: string
  contactType: string
  geoZone: string | null
  dealOwner: string | null
  vertical: string[]
  subVertical: string[]
  outreachGroup: string | null
  acquisitionSource: string | null
  acquisitionSourceDetail: string | null
  lastInteraction: string | null
  totalInteractions: number
  city: string | null
  country: string | null
  icpFit: string | null
  relationshipStrength: string | null
  createdAt: string
}

interface ColumnDef {
  key: string
  label: string
  type: "text" | "select" | "multiSelect" | "company" | "readonly"
  field: string
  width: number
  minWidth: number
  defaultVisible: boolean
  sortField?: string
  options?: { value: string; label: string; color?: string }[]
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface InlineEditableTableProps {
  contacts: TableContact[]
  loading: boolean
  pagination: Pagination
  sortBy: string
  sortDir: "asc" | "desc"
  onSort: (field: string, dir: "asc" | "desc") => void
  onPageChange: (page: number) => void
  onCellSave: (contactId: string, data: Record<string, unknown>) => Promise<boolean>
  onCreateContact: (data: Record<string, unknown>) => Promise<string | null>
  onDeleteContacts: (ids: string[]) => Promise<boolean>
  onBulkUpdate: (ids: string[], data: Record<string, unknown>) => Promise<boolean>
  onContactClick: (id: string) => void
  onPushToLemlist?: (contacts: TableContact[]) => void
}

/* ══════════════════════════════════════════════
   COLUMN DEFINITIONS
   ══════════════════════════════════════════════ */
const DEFAULT_COLUMNS: ColumnDef[] = [
  { key: "name", label: "Name", type: "text", field: "name", width: 180, minWidth: 120, defaultVisible: true, sortField: "firstName" },
  { key: "company", label: "Company", type: "company", field: "companyId", width: 160, minWidth: 100, defaultVisible: true },
  { key: "jobTitle", label: "Job Title", type: "text", field: "jobTitle", width: 150, minWidth: 100, defaultVisible: true },
  { key: "email", label: "Email", type: "text", field: "email", width: 200, minWidth: 120, defaultVisible: true, sortField: "email" },
  { key: "outreachGroup", label: "Outreach Group", type: "select", field: "outreachGroup", width: 155, minWidth: 100, defaultVisible: true,
    options: OUTREACH_GROUPS.map(g => ({ value: g.id, label: g.short, color: g.color })) },
  { key: "lifecycleStage", label: "Stage", type: "select", field: "lifecycleStage", width: 145, minWidth: 100, defaultVisible: true, sortField: "lifecycleStage",
    options: LIFECYCLE_STAGES.map(s => ({ value: s, label: STAGE_LABELS[s] || s, color: STAGE_COLORS[s] })) },
  { key: "dealOwner", label: "Owner", type: "select", field: "dealOwner", width: 130, minWidth: 90, defaultVisible: true, sortField: "dealOwner",
    options: DEAL_OWNERS.map(o => ({ value: o, label: o, color: OWNER_COLORS[o] })) },
  { key: "lastInteraction", label: "Last Interaction", type: "readonly", field: "lastInteraction", width: 130, minWidth: 100, defaultVisible: true, sortField: "lastInteraction" },
  { key: "totalInteractions", label: "Interactions", type: "readonly", field: "totalInteractions", width: 100, minWidth: 80, defaultVisible: true, sortField: "totalInteractions" },
  // Hidden by default
  { key: "phone", label: "Phone", type: "text", field: "phone", width: 140, minWidth: 100, defaultVisible: false },
  { key: "vertical", label: "Vertical", type: "multiSelect", field: "vertical", width: 170, minWidth: 120, defaultVisible: false,
    options: VERTICALS.map(v => ({ value: v, label: v })) },
  { key: "subVertical", label: "Sub-vertical", type: "multiSelect", field: "subVertical", width: 180, minWidth: 120, defaultVisible: false,
    options: SUB_VERTICALS.map(v => ({ value: v, label: v })) },
  { key: "geoZone", label: "Geo Zone", type: "select", field: "geoZone", width: 120, minWidth: 80, defaultVisible: false, sortField: "geoZone",
    options: GEO_ZONES.map(g => ({ value: g, label: g })) },
  { key: "acquisitionSource", label: "Acquisition Source", type: "select", field: "acquisitionSource", width: 170, minWidth: 100, defaultVisible: false,
    options: ACQUISITION_SOURCES.map(s => ({ value: s, label: s })) },
  { key: "city", label: "City", type: "text", field: "city", width: 120, minWidth: 80, defaultVisible: false },
  { key: "country", label: "Country", type: "text", field: "country", width: 120, minWidth: 80, defaultVisible: false },
  { key: "icpFit", label: "ICP Score", type: "select", field: "icpFit", width: 110, minWidth: 80, defaultVisible: false,
    options: ICP_FITS.map(f => ({ value: f.id, label: f.label, color: f.color })) },
  { key: "relationshipStrength", label: "Rel. Strength", type: "select", field: "relationshipStrength", width: 135, minWidth: 100, defaultVisible: false,
    options: RELATIONSHIP_STRENGTHS.map(r => ({ value: r.id, label: r.label, color: r.color })) },
  { key: "contactType", label: "Type", type: "select", field: "contactType", width: 110, minWidth: 80, defaultVisible: false,
    options: CONTACT_TYPES.map(t => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) })) },
]

/* ── Column persistence ── */
interface SavedCol { key: string; visible: boolean; width: number }
const LS_KEY = "crm_table_cols_v2"

function loadColumns(): { key: string; visible: boolean; width: number }[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return []
    return JSON.parse(raw) as SavedCol[]
  } catch { return [] }
}

function mergeColumns(saved: SavedCol[]): ColumnDef[] {
  if (saved.length === 0) return DEFAULT_COLUMNS.map(c => ({ ...c }))
  const savedMap = new Map(saved.map(s => [s.key, s]))
  const result: ColumnDef[] = []
  // Saved order first
  for (const s of saved) {
    const def = DEFAULT_COLUMNS.find(d => d.key === s.key)
    if (def) result.push({ ...def, width: s.width, defaultVisible: s.visible })
  }
  // Any new columns not in saved
  for (const def of DEFAULT_COLUMNS) {
    if (!savedMap.has(def.key)) result.push({ ...def })
  }
  return result
}

function saveColumns(cols: ColumnDef[]): void {
  if (typeof window === "undefined") return
  const data: SavedCol[] = cols.map(c => ({ key: c.key, visible: c.defaultVisible, width: c.width }))
  localStorage.setItem(LS_KEY, JSON.stringify(data))
}

/* ── Helpers ── */
function relativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "No interactions"
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "Just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return `${Math.floor(days / 30)}mo ago`
}

function getCellValue(contact: TableContact, colKey: string): unknown {
  if (colKey === "name") return `${contact.firstName} ${contact.lastName}`.trim()
  if (colKey === "company") return contact.company
  const fieldMap: Record<string, unknown> = {
    jobTitle: contact.jobTitle, email: contact.email, phone: contact.phone,
    outreachGroup: contact.outreachGroup, lifecycleStage: contact.lifecycleStage,
    dealOwner: contact.dealOwner, lastInteraction: contact.lastInteraction,
    totalInteractions: contact.totalInteractions, vertical: contact.vertical,
    subVertical: contact.subVertical, geoZone: contact.geoZone,
    acquisitionSource: contact.acquisitionSource, city: contact.city,
    country: contact.country, icpFit: contact.icpFit,
    relationshipStrength: contact.relationshipStrength, contactType: contact.contactType,
  }
  return fieldMap[colKey] ?? null
}

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
}

/* ══════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════ */
export default function InlineEditableTable({
  contacts, loading, pagination, sortBy, sortDir,
  onSort, onPageChange, onCellSave, onCreateContact,
  onDeleteContacts, onBulkUpdate, onContactClick, onPushToLemlist,
}: InlineEditableTableProps) {

  /* ── Column state ── */
  const [columns, setColumns] = useState<ColumnDef[]>(() => mergeColumns(loadColumns()))
  const visibleCols = columns.filter(c => c.defaultVisible)

  const updateColumns = useCallback((fn: (prev: ColumnDef[]) => ColumnDef[]) => {
    setColumns(prev => { const next = fn(prev); saveColumns(next); return next })
  }, [])

  /* ── Edit state ── */
  const [editCell, setEditCell] = useState<{ rowId: string; colKey: string } | null>(null)
  const [editValue, setEditValue] = useState<unknown>(null)
  const [flashMap, setFlashMap] = useState<Record<string, "success" | "error">>({})
  const editRef = useRef<HTMLInputElement | HTMLSelectElement | null>(null)

  /* ── Selection state ── */
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const allSelected = contacts.length > 0 && contacts.every(c => selectedIds.has(c.id))

  /* ── UI state ── */
  const [showColSettings, setShowColSettings] = useState(false)
  const [addingRow, setAddingRow] = useState(false)
  const [newRowData, setNewRowData] = useState<Record<string, string>>({ firstName: "", lastName: "", email: "" })
  const [newRowSaving, setNewRowSaving] = useState(false)
  const [bulkAction, setBulkAction] = useState<string | null>(null)

  /* ── Company search state ── */
  const [companyResults, setCompanyResults] = useState<{ id: string; name: string }[]>([])
  const [companyLoading, setCompanyLoading] = useState(false)
  const companyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* ── Resize state ── */
  const resizeRef = useRef<{ colKey: string; startX: number; startW: number } | null>(null)

  /* ── Column drag reorder state ── */
  const [dragCol, setDragCol] = useState<string | null>(null)
  const [dragOverCol, setDragOverCol] = useState<string | null>(null)

  /* ── Multi-select dropdown ref ── */
  const msDropdownRef = useRef<HTMLDivElement | null>(null)

  /* ═══ Flash helper ═══ */
  const flashCell = useCallback((rowId: string, colKey: string, type: "success" | "error") => {
    const key = `${rowId}:${colKey}`
    setFlashMap(prev => ({ ...prev, [key]: type }))
    setTimeout(() => setFlashMap(prev => { const n = { ...prev }; delete n[key]; return n }), 900)
  }, [])

  /* ═══ Start editing ═══ */
  const startEdit = useCallback((rowId: string, colKey: string) => {
    const col = columns.find(c => c.key === colKey)
    if (!col || col.type === "readonly") return
    const contact = contacts.find(c => c.id === rowId)
    if (!contact) return
    setEditCell({ rowId, colKey })
    setEditValue(getCellValue(contact, colKey))
    // For company, load search
    if (colKey === "company") {
      setCompanyResults([])
    }
  }, [columns, contacts])

  /* ═══ Save edit ═══ */
  const saveEdit = useCallback(async () => {
    if (!editCell) return
    const { rowId, colKey } = editCell
    const col = columns.find(c => c.key === colKey)
    if (!col) { setEditCell(null); return }

    let data: Record<string, unknown> = {}

    if (colKey === "name") {
      const parts = (editValue as string || "").trim().split(/\s+/)
      const firstName = parts[0] || ""
      const lastName = parts.slice(1).join(" ") || ""
      if (!firstName) { flashCell(rowId, colKey, "error"); setEditCell(null); return }
      data = { firstName, lastName }
    } else if (colKey === "company") {
      const co = editValue as { id: string; name: string } | null
      data = { companyId: co?.id || null }
    } else if (colKey === "email") {
      const email = (editValue as string || "").trim()
      if (email && !isValidEmail(email)) { flashCell(rowId, colKey, "error"); setEditCell(null); return }
      data = { email: email || null }
    } else {
      data = { [col.field]: editValue }
    }

    setEditCell(null)
    const ok = await onCellSave(rowId, data)
    flashCell(rowId, colKey, ok ? "success" : "error")
  }, [editCell, editValue, columns, onCellSave, flashCell])

  /* ═══ Cancel edit ═══ */
  const cancelEdit = useCallback(() => { setEditCell(null) }, [])

  /* ═══ Tab navigation ═══ */
  const handleTab = useCallback((reverse: boolean) => {
    if (!editCell) return
    const editable = visibleCols.filter(c => c.type !== "readonly")
    const ci = editable.findIndex(c => c.key === editCell.colKey)
    const ri = contacts.findIndex(c => c.id === editCell.rowId)
    let nc = ci, nr = ri
    if (reverse) { nc--; if (nc < 0) { nr--; nc = editable.length - 1 } }
    else { nc++; if (nc >= editable.length) { nr++; nc = 0 } }
    // Save current first
    saveEdit()
    if (nr >= 0 && nr < contacts.length) {
      setTimeout(() => startEdit(contacts[nr].id, editable[nc].key), 30)
    }
  }, [editCell, visibleCols, contacts, saveEdit, startEdit])

  /* ═══ Key handler ═══ */
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!editCell) return
    if (e.key === "Escape") { e.preventDefault(); cancelEdit(); return }
    if (e.key === "Enter" && editCell) {
      const col = columns.find(c => c.key === editCell.colKey)
      if (col?.type === "multiSelect") return // Enter doesn't save multiselect
      e.preventDefault(); saveEdit(); return
    }
    if (e.key === "Tab") { e.preventDefault(); handleTab(e.shiftKey) }
  }, [editCell, columns, cancelEdit, saveEdit, handleTab])

  /* ═══ Company search ═══ */
  const searchCompanies = useCallback((query: string) => {
    if (companyTimerRef.current) clearTimeout(companyTimerRef.current)
    if (!query.trim()) { setCompanyResults([]); return }
    companyTimerRef.current = setTimeout(async () => {
      setCompanyLoading(true)
      try {
        const res = await fetch(`/api/crm/companies?search=${encodeURIComponent(query)}`)
        const data = await res.json()
        setCompanyResults((data.companies || []).slice(0, 8).map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })))
      } catch { setCompanyResults([]) }
      setCompanyLoading(false)
    }, 300)
  }, [])

  /* ═══ Click outside multi-select / company dropdown ═══ */
  useEffect(() => {
    if (!editCell) return
    const col = columns.find(c => c.key === editCell.colKey)
    if (col?.type !== "multiSelect" && col?.type !== "company") return
    const handler = (e: MouseEvent) => {
      if (msDropdownRef.current && !msDropdownRef.current.contains(e.target as Node)) {
        saveEdit()
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [editCell, columns, saveEdit])

  /* ═══ Auto-focus input ═══ */
  useEffect(() => {
    if (editCell && editRef.current) {
      editRef.current.focus()
      if (editRef.current instanceof HTMLInputElement) editRef.current.select()
    }
  }, [editCell])

  /* ═══ Resize handlers ═══ */
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!resizeRef.current) return
      const { colKey, startX, startW } = resizeRef.current
      const col = columns.find(c => c.key === colKey)
      const newW = Math.max(col?.minWidth || 60, startW + e.clientX - startX)
      updateColumns(prev => prev.map(c => c.key === colKey ? { ...c, width: newW } : c))
    }
    const onUp = () => { resizeRef.current = null; document.body.style.cursor = "" }
    document.addEventListener("mousemove", onMove)
    document.addEventListener("mouseup", onUp)
    return () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp) }
  }, [columns, updateColumns])

  const startResize = (colKey: string, e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    const col = columns.find(c => c.key === colKey)
    resizeRef.current = { colKey, startX: e.clientX, startW: col?.width || 100 }
    document.body.style.cursor = "col-resize"
  }

  /* ═══ Column drag reorder ═══ */
  const handleColDrop = useCallback((targetKey: string) => {
    if (!dragCol || dragCol === targetKey) { setDragCol(null); setDragOverCol(null); return }
    updateColumns(prev => {
      const arr = [...prev]
      const fromIdx = arr.findIndex(c => c.key === dragCol)
      const toIdx = arr.findIndex(c => c.key === targetKey)
      if (fromIdx < 0 || toIdx < 0) return prev
      const [moved] = arr.splice(fromIdx, 1)
      arr.splice(toIdx, 0, moved)
      return arr
    })
    setDragCol(null); setDragOverCol(null)
  }, [dragCol, updateColumns])

  /* ═══ Selection ═══ */
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  const toggleAll = () => {
    if (allSelected) setSelectedIds(new Set())
    else setSelectedIds(new Set(contacts.map(c => c.id)))
  }

  /* ═══ Bulk actions ═══ */
  const handleBulk = useCallback(async (action: string, value?: unknown) => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    if (action === "delete") {
      const ok = await onDeleteContacts(ids)
      if (ok) setSelectedIds(new Set())
    } else if (action === "dealOwner" || action === "lifecycleStage") {
      const ok = await onBulkUpdate(ids, { [action]: value })
      if (ok) setSelectedIds(new Set())
    } else if (action === "export") {
      // Download as CSV
      const params = new URLSearchParams()
      params.set("ids", ids.join(","))
      window.open(`/api/crm/contacts/export?${params}`, "_blank")
    }
    setBulkAction(null)
  }, [selectedIds, onDeleteContacts, onBulkUpdate])

  /* ═══ Quick-add row ═══ */
  const saveNewRow = useCallback(async () => {
    const { firstName, lastName, email } = newRowData
    if (!firstName?.trim() || !lastName?.trim() || !email?.trim()) return
    if (!isValidEmail(email.trim())) return
    setNewRowSaving(true)
    const geoZone = (newRowData.geoZone as string) || null
    const data: Record<string, unknown> = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      jobTitle: newRowData.jobTitle || null,
      geoZone,
      dealOwner: getOwnerForGeo(geoZone),
      lifecycleStage: "new_lead",
      contactType: "prospect",
    }
    const id = await onCreateContact(data)
    setNewRowSaving(false)
    if (id) {
      setAddingRow(false)
      setNewRowData({ firstName: "", lastName: "", email: "" })
    }
  }, [newRowData, onCreateContact])

  /* ═══ Sort handler ═══ */
  const handleSort = (col: ColumnDef) => {
    if (!col.sortField) return
    if (sortBy === col.sortField) onSort(col.sortField, sortDir === "asc" ? "desc" : "asc")
    else onSort(col.sortField, "asc")
  }

  const sortArrow = (col: ColumnDef) => {
    if (!col.sortField || sortBy !== col.sortField) return ""
    return sortDir === "asc" ? " ↑" : " ↓"
  }

  /* ═════════════════════════════════════════
     RENDER: Cell display
     ═════════════════════════════════════════ */
  function renderDisplay(contact: TableContact, col: ColumnDef) {
    const val = getCellValue(contact, col.key)

    if (col.key === "name") {
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={(e) => { e.stopPropagation(); onContactClick(contact.id) }}
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: TEXT3, display: "flex", flexShrink: 0, opacity: 0.5 }}
            title="Open contact"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          </button>
          <span style={{ fontWeight: 500, color: TEXT }}>{val as string}</span>
        </div>
      )
    }

    if (col.key === "company") {
      const co = val as { id: string; name: string } | null
      if (!co) return <span style={{ color: TEXT3, fontSize: 12 }}>—</span>
      return <span style={{ color: TEXT2, fontSize: 13 }}>{co.name}</span>
    }

    if (col.key === "lastInteraction") {
      const t = relativeTime(val as string | null)
      return <span style={{ color: t === "No interactions" ? TEXT3 : TEXT2, fontSize: 12 }}>{t}</span>
    }

    if (col.key === "totalInteractions") {
      return <span style={{ fontFamily: "'Bellfair', serif", fontSize: 14, color: TEXT }}>{val as number}</span>
    }

    if (col.type === "select" && col.options) {
      const str = val as string | null
      if (!str) return <span style={{ color: TEXT3, fontSize: 12 }}>—</span>
      const opt = col.options.find(o => o.value === str)
      if (col.key === "dealOwner" && str) {
        const oc = OWNER_COLORS[str] || "#9CA3AF"
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 18, height: 18, borderRadius: "50%", background: oc, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#fff", flexShrink: 0 }}>{str.charAt(0)}</div>
            <span style={{ fontSize: 12, color: TEXT2 }}>{str}</span>
          </div>
        )
      }
      const color = opt?.color || "#9CA3AF"
      return (
        <span style={{ display: "inline-block", padding: "2px 8px", fontSize: 10, fontWeight: 500, fontFamily: FONT, borderRadius: 16, background: `${color}18`, color, whiteSpace: "nowrap" }}>
          {opt?.label || str}
        </span>
      )
    }

    if (col.type === "multiSelect") {
      const arr = (val as string[]) || []
      if (arr.length === 0) return <span style={{ color: TEXT3, fontSize: 12 }}>—</span>
      return (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
          {arr.slice(0, 2).map(v => (
            <span key={v} style={{ display: "inline-block", padding: "1px 6px", fontSize: 10, fontWeight: 500, fontFamily: FONT, borderRadius: 10, background: `${ROSE}15`, color: ROSE, whiteSpace: "nowrap", maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis" }}>
              {v}
            </span>
          ))}
          {arr.length > 2 && <span style={{ fontSize: 10, color: TEXT3 }}>+{arr.length - 2}</span>}
        </div>
      )
    }

    // Text fields
    const str = val as string | null
    if (!str) return <span style={{ color: TEXT3, fontSize: 12 }}>—</span>
    return <span style={{ color: TEXT2, fontSize: 13 }}>{str}</span>
  }

  /* ═════════════════════════════════════════
     RENDER: Cell editor
     ═════════════════════════════════════════ */
  function renderEditor(contact: TableContact, col: ColumnDef) {
    const inputStyle: React.CSSProperties = {
      width: "100%", background: "var(--surface-input)", border: `1.5px solid ${EDIT_BORDER}`,
      borderRadius: 4, color: TEXT, padding: "4px 8px", fontSize: 13, fontFamily: FONT,
      outline: "none",
    }

    if (col.type === "text" || col.key === "name") {
      return (
        <input
          ref={editRef as React.RefObject<HTMLInputElement>}
          type="text"
          value={editValue as string || ""}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={() => saveEdit()}
          onKeyDown={handleKeyDown}
          style={inputStyle}
        />
      )
    }

    if (col.type === "select" && col.options) {
      return (
        <select
          ref={editRef as React.RefObject<HTMLSelectElement>}
          value={editValue as string || ""}
          onChange={(e) => { setEditValue(e.target.value || null); setTimeout(() => saveEdit(), 10) }}
          onBlur={() => saveEdit()}
          onKeyDown={handleKeyDown}
          style={{ ...inputStyle, padding: "3px 6px" }}
        >
          <option value="">— None —</option>
          {col.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )
    }

    if (col.type === "multiSelect" && col.options) {
      const selected = (editValue as string[]) || []
      return (
        <div ref={msDropdownRef} style={{ position: "relative" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 3, minHeight: 26, padding: "2px 4px", border: `1.5px solid ${EDIT_BORDER}`, borderRadius: 4, background: "var(--surface-input)", cursor: "pointer" }}>
            {selected.length === 0 && <span style={{ fontSize: 12, color: TEXT3, padding: "2px 4px" }}>Select...</span>}
            {selected.map(v => (
              <span key={v} style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "1px 6px", fontSize: 10, fontWeight: 500, fontFamily: FONT, borderRadius: 10, background: `${ROSE}20`, color: ROSE }}>
                {v.length > 18 ? v.slice(0, 18) + "…" : v}
                <span
                  onClick={(e) => { e.stopPropagation(); setEditValue((selected).filter(s => s !== v)) }}
                  style={{ cursor: "pointer", fontWeight: 700, fontSize: 11 }}
                >×</span>
              </span>
            ))}
          </div>
          <div style={{
            position: "absolute", top: "100%", left: 0, zIndex: 60, width: Math.max(col.width, 200),
            maxHeight: 220, overflowY: "auto", background: "var(--card-bg-solid)", border: `1px solid ${CARD_BORDER}`,
            borderRadius: 8, marginTop: 2, boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
          }}>
            {col.options.map(o => {
              const checked = selected.includes(o.value)
              return (
                <div
                  key={o.value}
                  onClick={() => {
                    if (checked) setEditValue(selected.filter(s => s !== o.value))
                    else setEditValue([...selected, o.value])
                  }}
                  style={{ padding: "6px 10px", fontSize: 12, fontFamily: FONT, color: checked ? TEXT : TEXT2, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, background: checked ? "rgba(192,139,136,0.08)" : "transparent" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "var(--surface-input)")}
                  onMouseLeave={e => (e.currentTarget.style.background = checked ? "rgba(192,139,136,0.08)" : "transparent")}
                >
                  <div style={{ width: 14, height: 14, borderRadius: 3, border: `1.5px solid ${checked ? ROSE : CARD_BORDER}`, background: checked ? `${ROSE}30` : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: ROSE, flexShrink: 0 }}>
                    {checked && "✓"}
                  </div>
                  <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{o.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      )
    }

    if (col.type === "company") {
      const co = editValue as { id: string; name: string } | null
      return (
        <div ref={msDropdownRef} style={{ position: "relative" }}>
          <input
            ref={editRef as React.RefObject<HTMLInputElement>}
            type="text"
            placeholder="Search company..."
            defaultValue={co?.name || ""}
            onChange={(e) => searchCompanies(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") cancelEdit() }}
            style={inputStyle}
          />
          {(companyResults.length > 0 || companyLoading) && (
            <div style={{
              position: "absolute", top: "100%", left: 0, zIndex: 60, width: Math.max(col.width, 200),
              maxHeight: 200, overflowY: "auto", background: "var(--card-bg-solid)", border: `1px solid ${CARD_BORDER}`,
              borderRadius: 8, marginTop: 2, boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
            }}>
              {companyLoading && <div style={{ padding: "8px 12px", fontSize: 12, color: TEXT3, fontFamily: FONT }}>Searching...</div>}
              {companyResults.map(c => (
                <div
                  key={c.id}
                  onClick={() => { setEditValue(c); setTimeout(() => saveEdit(), 20) }}
                  style={{ padding: "7px 12px", fontSize: 12, fontFamily: FONT, color: TEXT, cursor: "pointer" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "var(--surface-input)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  {c.name}
                </div>
              ))}
            </div>
          )}
          {co && (
            <button
              onClick={() => { setEditValue(null); setTimeout(() => saveEdit(), 20) }}
              style={{ position: "absolute", right: 6, top: 5, background: "none", border: "none", color: TEXT3, cursor: "pointer", fontSize: 13, padding: 0 }}
              title="Clear company"
            >×</button>
          )}
        </div>
      )
    }

    return null
  }

  /* ═════════════════════════════════════════
     RENDER: Column settings panel
     ═════════════════════════════════════════ */
  function renderColSettings() {
    if (!showColSettings) return null
    return (
      <div style={{
        position: "absolute", right: 0, top: "100%", zIndex: 80, width: 260,
        background: "var(--card-bg-solid)", border: `1px solid ${CARD_BORDER}`, borderRadius: 10,
        boxShadow: "0 12px 36px rgba(0,0,0,0.6)", padding: "10px 0", maxHeight: 400, overflowY: "auto",
      }}>
        <div style={{ padding: "6px 14px 10px", fontSize: 11, fontWeight: 600, color: TEXT3, fontFamily: FONT, textTransform: "uppercase", letterSpacing: 0.6 }}>Columns</div>
        {columns.map((col, i) => (
          <div key={col.key} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 14px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, cursor: "pointer", fontSize: 12, fontFamily: FONT, color: col.defaultVisible ? TEXT : TEXT3 }}>
              <input
                type="checkbox"
                checked={col.defaultVisible}
                onChange={() => updateColumns(prev => prev.map(c => c.key === col.key ? { ...c, defaultVisible: !c.defaultVisible } : c))}
                style={{ accentColor: ROSE }}
              />
              {col.label}
            </label>
            <div style={{ display: "flex", gap: 2 }}>
              {i > 0 && (
                <button
                  onClick={() => updateColumns(prev => { const a = [...prev]; const t = a[i]; a[i] = a[i - 1]; a[i - 1] = t; return a })}
                  style={{ background: "none", border: "none", color: TEXT3, cursor: "pointer", fontSize: 11, padding: "2px 4px" }}
                >↑</button>
              )}
              {i < columns.length - 1 && (
                <button
                  onClick={() => updateColumns(prev => { const a = [...prev]; const t = a[i]; a[i] = a[i + 1]; a[i + 1] = t; return a })}
                  style={{ background: "none", border: "none", color: TEXT3, cursor: "pointer", fontSize: 11, padding: "2px 4px" }}
                >↓</button>
              )}
            </div>
          </div>
        ))}
      </div>
    )
  }

  /* ═════════════════════════════════════════
     RENDER: Bulk action bar
     ═════════════════════════════════════════ */
  function renderBulkBar() {
    if (selectedIds.size === 0) return null
    return (
      <div style={{
        display: "flex", alignItems: "center", gap: 12, padding: "8px 16px",
        background: `${ROSE}12`, borderBottom: `1px solid ${ROSE}30`, fontSize: 12, fontFamily: FONT,
      }}>
        <span style={{ color: TEXT, fontWeight: 600 }}>{selectedIds.size} selected</span>
        <div style={{ width: 1, height: 16, background: CARD_BORDER }} />

        {/* Change Owner */}
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setBulkAction(bulkAction === "owner" ? null : "owner")}
            style={{ background: "var(--surface-input)", border: `1px solid ${CARD_BORDER}`, borderRadius: 6, color: TEXT2, padding: "4px 10px", fontSize: 11, cursor: "pointer", fontFamily: FONT }}
          >Change Owner</button>
          {bulkAction === "owner" && (
            <div style={{ position: "absolute", top: "100%", left: 0, zIndex: 70, background: "var(--card-bg-solid)", border: `1px solid ${CARD_BORDER}`, borderRadius: 8, marginTop: 4, boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}>
              {DEAL_OWNERS.map(o => (
                <div key={o} onClick={() => handleBulk("dealOwner", o)} style={{ padding: "7px 16px", fontSize: 12, fontFamily: FONT, color: TEXT, cursor: "pointer", whiteSpace: "nowrap" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "var(--surface-input)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >{o}</div>
              ))}
            </div>
          )}
        </div>

        {/* Change Stage */}
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setBulkAction(bulkAction === "stage" ? null : "stage")}
            style={{ background: "var(--surface-input)", border: `1px solid ${CARD_BORDER}`, borderRadius: 6, color: TEXT2, padding: "4px 10px", fontSize: 11, cursor: "pointer", fontFamily: FONT }}
          >Change Stage</button>
          {bulkAction === "stage" && (
            <div style={{ position: "absolute", top: "100%", left: 0, zIndex: 70, background: "var(--card-bg-solid)", border: `1px solid ${CARD_BORDER}`, borderRadius: 8, marginTop: 4, boxShadow: "0 8px 24px rgba(0,0,0,0.5)", maxHeight: 250, overflowY: "auto" }}>
              {LIFECYCLE_STAGES.map(s => (
                <div key={s} onClick={() => handleBulk("lifecycleStage", s)} style={{ padding: "7px 16px", fontSize: 12, fontFamily: FONT, color: STAGE_COLORS[s] || TEXT, cursor: "pointer", whiteSpace: "nowrap" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "var(--surface-input)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >{STAGE_LABELS[s] || s}</div>
              ))}
            </div>
          )}
        </div>

        {/* Push to Lemlist */}
        {onPushToLemlist && (
          <button
            onClick={() => {
              const selected = contacts.filter(c => selectedIds.has(c.id))
              onPushToLemlist(selected)
            }}
            style={{ background: "var(--surface-input)", border: `1px solid ${CARD_BORDER}`, borderRadius: 6, color: TEXT2, padding: "4px 10px", fontSize: 11, cursor: "pointer", fontFamily: FONT }}
          >Push to Lemlist</button>
        )}

        {/* Export */}
        <button
          onClick={() => handleBulk("export")}
          style={{ background: "var(--surface-input)", border: `1px solid ${CARD_BORDER}`, borderRadius: 6, color: TEXT2, padding: "4px 10px", fontSize: 11, cursor: "pointer", fontFamily: FONT }}
        >Export</button>

        {/* Delete */}
        <button
          onClick={() => { if (confirm(`Delete ${selectedIds.size} contacts?`)) handleBulk("delete") }}
          style={{ background: "rgba(248,113,113,0.12)", border: `1px solid rgba(248,113,113,0.3)`, borderRadius: 6, color: "#F87171", padding: "4px 10px", fontSize: 11, cursor: "pointer", fontFamily: FONT, marginLeft: "auto" }}
        >Delete</button>
      </div>
    )
  }

  /* ═════════════════════════════════════════
     STYLES
     ═════════════════════════════════════════ */
  const thBase: React.CSSProperties = {
    textAlign: "left", fontSize: 10, color: TEXT3, textTransform: "uppercase",
    letterSpacing: 0.8, fontWeight: 600, fontFamily: FONT, userSelect: "none",
    whiteSpace: "nowrap", borderBottom: `1px solid ${CARD_BORDER}`, position: "relative",
  }
  const tdBase: React.CSSProperties = {
    fontSize: 13, fontFamily: FONT, borderBottom: `1px solid ${CARD_BORDER}`,
    color: TEXT, position: "relative", verticalAlign: "middle",
  }

  /* ═════════════════════════════════════════
     MAIN RENDER
     ═════════════════════════════════════════ */
  return (
    <div style={{ position: "relative" }}>
      {renderBulkBar()}

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", minWidth: visibleCols.reduce((s, c) => s + c.width, 40) }}>
          <thead>
            <tr>
              {/* Checkbox column */}
              <th style={{ ...thBase, width: 40, padding: "10px 10px", textAlign: "center" }}>
                <input type="checkbox" checked={allSelected} onChange={toggleAll} style={{ accentColor: ROSE, cursor: "pointer" }} />
              </th>

              {/* Data columns */}
              {visibleCols.map(col => (
                <th
                  key={col.key}
                  style={{ ...thBase, width: col.width, padding: "10px 10px", cursor: col.sortField ? "pointer" : "default" }}
                  draggable
                  onDragStart={() => setDragCol(col.key)}
                  onDragOver={(e) => { e.preventDefault(); setDragOverCol(col.key) }}
                  onDragLeave={() => setDragOverCol(prev => prev === col.key ? null : prev)}
                  onDrop={() => handleColDrop(col.key)}
                  onDragEnd={() => { setDragCol(null); setDragOverCol(null) }}
                  onClick={() => handleSort(col)}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 4, opacity: dragOverCol === col.key ? 0.5 : 1 }}>
                    <span>{col.label}{sortArrow(col)}</span>
                  </div>
                  {/* Resize handle */}
                  <div
                    onMouseDown={(e) => startResize(col.key, e)}
                    onClick={(e) => e.stopPropagation()}
                    style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 4, cursor: "col-resize", zIndex: 2 }}
                  />
                </th>
              ))}

              {/* Add column button */}
              <th style={{ ...thBase, width: 36, padding: "10px 4px", textAlign: "center", position: "relative" }}>
                <button
                  onClick={() => setShowColSettings(v => !v)}
                  title="Column settings"
                  style={{ background: "none", border: "none", color: TEXT3, cursor: "pointer", fontSize: 14, padding: 0 }}
                >+</button>
                {renderColSettings()}
              </th>
            </tr>
          </thead>
          <tbody>
            {loading && contacts.length === 0 ? (
              <tr>
                <td colSpan={visibleCols.length + 2} style={{ ...tdBase, textAlign: "center", padding: "40px 12px", color: TEXT3 }}>Loading...</td>
              </tr>
            ) : contacts.length === 0 ? (
              <tr>
                <td colSpan={visibleCols.length + 2} style={{ ...tdBase, textAlign: "center", padding: "40px 12px", color: TEXT3 }}>No contacts found</td>
              </tr>
            ) : (
              contacts.map(contact => {
                const isSelected = selectedIds.has(contact.id)
                return (
                  <tr
                    key={contact.id}
                    style={{ transition: "background 0.15s", background: isSelected ? "rgba(192,139,136,0.05)" : "transparent" }}
                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "var(--surface-hover)" }}
                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = "transparent" }}
                  >
                    {/* Checkbox */}
                    <td style={{ ...tdBase, width: 40, padding: "8px 10px", textAlign: "center" }}>
                      <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(contact.id)} style={{ accentColor: ROSE, cursor: "pointer" }} />
                    </td>

                    {/* Data cells */}
                    {visibleCols.map(col => {
                      const flashKey = `${contact.id}:${col.key}`
                      const flash = flashMap[flashKey]
                      const isEditing = editCell?.rowId === contact.id && editCell?.colKey === col.key
                      const isEditable = col.type !== "readonly"

                      return (
                        <td
                          key={col.key}
                          onClick={() => { if (!isEditing && isEditable) startEdit(contact.id, col.key) }}
                          onKeyDown={isEditing ? handleKeyDown : undefined}
                          style={{
                            ...tdBase,
                            width: col.width,
                            padding: isEditing ? "4px 6px" : "8px 10px",
                            cursor: isEditable ? "text" : "default",
                            background: flash === "success" ? "rgba(52,211,153,0.12)"
                              : flash === "error" ? "rgba(248,113,113,0.12)"
                              : isEditing ? "rgba(91,155,191,0.06)" : "transparent",
                            outline: isEditing ? `1.5px solid ${EDIT_BORDER}` : "none",
                            outlineOffset: -1,
                            borderRadius: isEditing ? 3 : 0,
                            transition: "background 0.3s",
                            overflow: "hidden",
                          }}
                        >
                          {isEditing ? renderEditor(contact, col) : renderDisplay(contact, col)}
                        </td>
                      )
                    })}

                    {/* Spacer for add-column */}
                    <td style={{ ...tdBase, width: 36 }} />
                  </tr>
                )
              })
            )}

            {/* Quick-add row */}
            {addingRow ? (
              <tr style={{ background: "rgba(192,139,136,0.04)" }}>
                <td style={{ ...tdBase, padding: "8px 10px", textAlign: "center" }} />
                {visibleCols.map(col => {
                  if (col.key === "name") {
                    return (
                      <td key={col.key} style={{ ...tdBase, padding: "4px 6px" }}>
                        <div style={{ display: "flex", gap: 4 }}>
                          <input
                            placeholder="First"
                            value={newRowData.firstName || ""}
                            onChange={e => setNewRowData(p => ({ ...p, firstName: e.target.value }))}
                            onKeyDown={e => { if (e.key === "Enter") saveNewRow(); if (e.key === "Escape") setAddingRow(false) }}
                            style={{ flex: 1, background: "var(--surface-input)", border: `1px solid ${CARD_BORDER}`, borderRadius: 4, color: TEXT, padding: "4px 6px", fontSize: 12, fontFamily: FONT, outline: "none", minWidth: 0 }}
                            autoFocus
                          />
                          <input
                            placeholder="Last"
                            value={newRowData.lastName || ""}
                            onChange={e => setNewRowData(p => ({ ...p, lastName: e.target.value }))}
                            onKeyDown={e => { if (e.key === "Enter") saveNewRow(); if (e.key === "Escape") setAddingRow(false) }}
                            style={{ flex: 1, background: "var(--surface-input)", border: `1px solid ${CARD_BORDER}`, borderRadius: 4, color: TEXT, padding: "4px 6px", fontSize: 12, fontFamily: FONT, outline: "none", minWidth: 0 }}
                          />
                        </div>
                      </td>
                    )
                  }
                  if (col.key === "email") {
                    return (
                      <td key={col.key} style={{ ...tdBase, padding: "4px 6px" }}>
                        <input
                          placeholder="email@example.com"
                          value={newRowData.email || ""}
                          onChange={e => setNewRowData(p => ({ ...p, email: e.target.value }))}
                          onKeyDown={e => { if (e.key === "Enter") saveNewRow(); if (e.key === "Escape") setAddingRow(false) }}
                          style={{ width: "100%", background: "var(--surface-input)", border: `1px solid ${CARD_BORDER}`, borderRadius: 4, color: TEXT, padding: "4px 6px", fontSize: 12, fontFamily: FONT, outline: "none" }}
                        />
                      </td>
                    )
                  }
                  if (col.key === "jobTitle") {
                    return (
                      <td key={col.key} style={{ ...tdBase, padding: "4px 6px" }}>
                        <input
                          placeholder="Job title"
                          value={newRowData.jobTitle || ""}
                          onChange={e => setNewRowData(p => ({ ...p, jobTitle: e.target.value }))}
                          onKeyDown={e => { if (e.key === "Enter") saveNewRow(); if (e.key === "Escape") setAddingRow(false) }}
                          style={{ width: "100%", background: "var(--surface-input)", border: `1px solid ${CARD_BORDER}`, borderRadius: 4, color: TEXT, padding: "4px 6px", fontSize: 12, fontFamily: FONT, outline: "none" }}
                        />
                      </td>
                    )
                  }
                  return <td key={col.key} style={{ ...tdBase, padding: "8px 10px", color: TEXT3, fontSize: 11 }}>—</td>
                })}
                <td style={{ ...tdBase, padding: "4px 6px" }}>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button
                      onClick={saveNewRow}
                      disabled={newRowSaving}
                      style={{ background: `${ROSE}20`, border: "none", borderRadius: 4, color: ROSE, padding: "3px 8px", fontSize: 11, cursor: "pointer", fontFamily: FONT, fontWeight: 600 }}
                    >{newRowSaving ? "..." : "Save"}</button>
                    <button
                      onClick={() => { setAddingRow(false); setNewRowData({ firstName: "", lastName: "", email: "" }) }}
                      style={{ background: "none", border: `1px solid ${CARD_BORDER}`, borderRadius: 4, color: TEXT3, padding: "3px 8px", fontSize: 11, cursor: "pointer", fontFamily: FONT }}
                    >Cancel</button>
                  </div>
                </td>
              </tr>
            ) : (
              <tr>
                <td colSpan={visibleCols.length + 2} style={{ borderBottom: "none", padding: "6px 10px" }}>
                  <button
                    onClick={() => setAddingRow(true)}
                    style={{ background: "none", border: "none", color: TEXT3, fontSize: 12, fontFamily: FONT, cursor: "pointer", padding: "4px 8px", display: "flex", alignItems: "center", gap: 6 }}
                    onMouseEnter={e => (e.currentTarget.style.color = ROSE)}
                    onMouseLeave={e => (e.currentTarget.style.color = TEXT3)}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Add person
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, padding: "14px 0", borderTop: `1px solid ${CARD_BORDER}` }}>
          <button
            onClick={() => onPageChange(pagination.page - 1)}
            disabled={pagination.page <= 1}
            style={{ padding: "5px 12px", borderRadius: 6, border: `1px solid ${CARD_BORDER}`, background: "transparent", color: pagination.page <= 1 ? TEXT3 : TEXT2, fontSize: 12, cursor: pagination.page <= 1 ? "default" : "pointer", fontFamily: FONT }}
          >Previous</button>
          <span style={{ fontSize: 12, color: TEXT2, fontFamily: FONT }}>Page {pagination.page} of {pagination.totalPages}</span>
          <button
            onClick={() => onPageChange(pagination.page + 1)}
            disabled={pagination.page >= pagination.totalPages}
            style={{ padding: "5px 12px", borderRadius: 6, border: `1px solid ${CARD_BORDER}`, background: "transparent", color: pagination.page >= pagination.totalPages ? TEXT3 : TEXT2, fontSize: 12, cursor: pagination.page >= pagination.totalPages ? "default" : "pointer", fontFamily: FONT }}
          >Next</button>
        </div>
      )}
    </div>
  )
}
