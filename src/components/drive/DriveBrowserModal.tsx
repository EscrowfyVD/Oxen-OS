"use client"

import { useState, useEffect, useCallback } from "react"

const CARD_BG = "rgba(15,17,24,0.6)"
const CARD_BORDER = "rgba(255,255,255,0.06)"
const FROST = "#F0F0F2"
const TEXT_SECONDARY = "rgba(240,240,242,0.55)"
const TEXT_TERTIARY = "rgba(240,240,242,0.3)"
const ROSE_GOLD = "#C08B88"

const CATEGORY_OPTIONS = [
  { value: "contract", label: "Contract" },
  { value: "kyc", label: "KYC" },
  { value: "invoice", label: "Invoice" },
  { value: "proposal", label: "Proposal" },
  { value: "legal", label: "Legal" },
  { value: "compliance", label: "Compliance" },
  { value: "process", label: "Process" },
  { value: "other", label: "Other" },
]

export const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  contract:   { bg: "rgba(192,139,136,0.12)", text: "#C08B88" },
  kyc:        { bg: "rgba(251,191,36,0.12)",  text: "#FBBF24" },
  invoice:    { bg: "rgba(52,211,153,0.12)",  text: "#34D399" },
  proposal:   { bg: "rgba(129,140,248,0.12)", text: "#818CF8" },
  legal:      { bg: "rgba(167,139,250,0.12)", text: "#A78BFA" },
  compliance: { bg: "rgba(251,191,36,0.12)",  text: "#FBBF24" },
  process:    { bg: "rgba(91,184,168,0.12)",  text: "#5BB8A8" },
  other:      { bg: "rgba(255,255,255,0.06)", text: TEXT_SECONDARY },
}

interface DriveFile {
  id: string
  name: string
  mimeType: string
  webViewLink: string
  iconLink: string
  modifiedTime: string
  starred: boolean
  owners?: Array<{ displayName: string }>
}

interface Props {
  onSelect: (file: DriveFile, category: string) => void
  onClose: () => void
}

function getMimeIcon(mimeType: string): string {
  if (mimeType === "application/vnd.google-apps.folder") return "\uD83D\uDCC1"
  if (mimeType.includes("document") || mimeType.includes("word")) return "\uD83D\uDCC4"
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return "\uD83D\uDCCA"
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) return "\uD83D\uDCCA"
  if (mimeType.includes("pdf")) return "\uD83D\uDCC4"
  if (mimeType.includes("image")) return "\uD83D\uDDBC\uFE0F"
  return "\uD83D\uDCC4"
}

function getMimeLabel(mimeType: string): string {
  if (mimeType === "application/vnd.google-apps.folder") return "Folder"
  if (mimeType === "application/vnd.google-apps.document") return "Doc"
  if (mimeType === "application/vnd.google-apps.spreadsheet") return "Sheet"
  if (mimeType === "application/vnd.google-apps.presentation") return "Slides"
  if (mimeType.includes("pdf")) return "PDF"
  if (mimeType.includes("image")) return "Image"
  return "File"
}

export default function DriveBrowserModal({ onSelect, onClose }: Props) {
  const [files, setFiles] = useState<DriveFile[]>([])
  const [search, setSearch] = useState("")
  const [folderStack, setFolderStack] = useState<Array<{ id: string; name: string }>>([])
  const [loading, setLoading] = useState(true)
  const [selectedFile, setSelectedFile] = useState<DriveFile | null>(null)
  const [category, setCategory] = useState("other")
  const [viewMode, setViewMode] = useState<"list" | "grid">("list")

  const currentFolderId = folderStack.length > 0 ? folderStack[folderStack.length - 1].id : undefined

  const fetchFiles = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (currentFolderId) params.set("folderId", currentFolderId)
    if (search) params.set("q", search)

    fetch(`/api/drive/files?${params}`)
      .then((r) => r.json())
      .then((data) => setFiles(data.files ?? []))
      .catch(() => setFiles([]))
      .finally(() => setLoading(false))
  }, [currentFolderId, search])

  useEffect(() => {
    const timer = setTimeout(fetchFiles, search ? 300 : 0)
    return () => clearTimeout(timer)
  }, [fetchFiles, search])

  const navigateFolder = (file: DriveFile) => {
    if (file.mimeType === "application/vnd.google-apps.folder") {
      setFolderStack([...folderStack, { id: file.id, name: file.name }])
      setSearch("")
    }
  }

  const navigateBreadcrumb = (index: number) => {
    setFolderStack(folderStack.slice(0, index + 1))
    setSearch("")
  }

  const goToRoot = () => {
    setFolderStack([])
    setSearch("")
  }

  const handleConfirm = () => {
    if (selectedFile) {
      onSelect(selectedFile, category)
    }
  }

  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: 10, color: TEXT_TERTIARY,
    textTransform: "uppercase", letterSpacing: 1, marginBottom: 6,
    fontFamily: "'DM Sans', sans-serif", fontWeight: 500,
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="animate-slideUp"
        style={{
          width: 680, maxHeight: "85vh",
          background: CARD_BG, border: `1px solid ${CARD_BORDER}`,
          borderRadius: 14, display: "flex", flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px", borderBottom: `1px solid ${CARD_BORDER}`,
        }}>
          <span style={{ fontFamily: "'Bellfair', serif", fontSize: 18, color: FROST }}>
            {"\uD83D\uDCC1"} Link from Drive
          </span>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: TEXT_TERTIARY, fontSize: 18, cursor: "pointer", padding: 4, lineHeight: 1 }}
          >
            &times;
          </button>
        </div>

        {/* Search + breadcrumbs */}
        <div style={{ padding: "12px 20px", borderBottom: `1px solid ${CARD_BORDER}` }}>
          <input
            type="text"
            placeholder="Search Drive..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="oxen-input"
            style={{ marginBottom: 8 }}
          />
          {/* Breadcrumbs */}
          <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
            <span
              onClick={goToRoot}
              style={{ fontSize: 11, color: folderStack.length > 0 ? ROSE_GOLD : TEXT_SECONDARY, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}
            >
              My Drive
            </span>
            {folderStack.map((f, i) => (
              <span key={f.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 10, color: TEXT_TERTIARY }}>/</span>
                <span
                  onClick={() => navigateBreadcrumb(i)}
                  style={{
                    fontSize: 11,
                    color: i === folderStack.length - 1 ? TEXT_SECONDARY : ROSE_GOLD,
                    cursor: "pointer",
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  {f.name}
                </span>
              </span>
            ))}

            {/* View toggle */}
            <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
              <button
                onClick={() => setViewMode("list")}
                style={{
                  padding: "2px 8px", borderRadius: 4, fontSize: 10, cursor: "pointer",
                  border: `1px solid ${viewMode === "list" ? "rgba(192,139,136,0.3)" : CARD_BORDER}`,
                  background: viewMode === "list" ? "rgba(192,139,136,0.1)" : "transparent",
                  color: viewMode === "list" ? ROSE_GOLD : TEXT_TERTIARY,
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                List
              </button>
              <button
                onClick={() => setViewMode("grid")}
                style={{
                  padding: "2px 8px", borderRadius: 4, fontSize: 10, cursor: "pointer",
                  border: `1px solid ${viewMode === "grid" ? "rgba(192,139,136,0.3)" : CARD_BORDER}`,
                  background: viewMode === "grid" ? "rgba(192,139,136,0.1)" : "transparent",
                  color: viewMode === "grid" ? ROSE_GOLD : TEXT_TERTIARY,
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                Grid
              </button>
            </div>
          </div>
        </div>

        {/* File list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 20px" }}>
          {loading && (
            <div style={{ textAlign: "center", padding: "40px 0", color: TEXT_TERTIARY, fontSize: 12, fontFamily: "'DM Sans', sans-serif" }}>
              Loading Drive files...
            </div>
          )}

          {!loading && files.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 0", color: TEXT_TERTIARY, fontSize: 12, fontFamily: "'DM Sans', sans-serif" }}>
              {search ? "No files match your search" : "This folder is empty"}
            </div>
          )}

          {!loading && viewMode === "list" && files.map((file) => {
            const isFolder = file.mimeType === "application/vnd.google-apps.folder"
            const isSelected = selectedFile?.id === file.id

            return (
              <div
                key={file.id}
                onClick={() => isFolder ? navigateFolder(file) : setSelectedFile(file)}
                style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "8px 10px",
                  borderRadius: 6, cursor: "pointer",
                  background: isSelected ? "rgba(192,139,136,0.08)" : "transparent",
                  border: isSelected ? "1px solid rgba(192,139,136,0.2)" : "1px solid transparent",
                  transition: "all 0.15s", marginBottom: 2,
                }}
                onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = "rgba(255,255,255,0.03)" }}
                onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = "transparent" }}
              >
                <span style={{ fontSize: 16, flexShrink: 0 }}>{getMimeIcon(file.mimeType)}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 12, color: FROST, fontFamily: "'DM Sans', sans-serif",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {file.starred && <span style={{ marginRight: 4, color: "#FBBF24" }}>{"\u2605"}</span>}
                    {file.name}
                  </div>
                </div>
                <span style={{
                  fontSize: 9, padding: "2px 6px", borderRadius: 4,
                  background: "rgba(255,255,255,0.04)", color: TEXT_TERTIARY,
                  fontFamily: "'DM Sans', sans-serif", flexShrink: 0,
                }}>
                  {getMimeLabel(file.mimeType)}
                </span>
                <span style={{ fontSize: 10, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif", flexShrink: 0 }}>
                  {new Date(file.modifiedTime).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                </span>
              </div>
            )
          })}

          {!loading && viewMode === "grid" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, padding: "8px 0" }}>
              {files.map((file) => {
                const isFolder = file.mimeType === "application/vnd.google-apps.folder"
                const isSelected = selectedFile?.id === file.id

                return (
                  <div
                    key={file.id}
                    onClick={() => isFolder ? navigateFolder(file) : setSelectedFile(file)}
                    style={{
                      padding: "14px 12px", borderRadius: 8, cursor: "pointer", textAlign: "center",
                      background: isSelected ? "rgba(192,139,136,0.08)" : "rgba(255,255,255,0.02)",
                      border: isSelected ? "1px solid rgba(192,139,136,0.2)" : `1px solid ${CARD_BORDER}`,
                      transition: "all 0.15s",
                    }}
                  >
                    <div style={{ fontSize: 28, marginBottom: 6 }}>{getMimeIcon(file.mimeType)}</div>
                    <div style={{
                      fontSize: 11, color: FROST, fontFamily: "'DM Sans', sans-serif",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {file.name}
                    </div>
                    <div style={{ fontSize: 9, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif", marginTop: 4 }}>
                      {getMimeLabel(file.mimeType)}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Category selector + confirm */}
        {selectedFile && (
          <div style={{
            padding: "16px 20px", borderTop: `1px solid ${CARD_BORDER}`,
            display: "flex", alignItems: "flex-end", gap: 12,
          }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Category</label>
              <select
                className="oxen-input"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={{ appearance: "none" }}
              >
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn-secondary" onClick={() => setSelectedFile(null)} style={{ padding: "8px 16px" }}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleConfirm} style={{ padding: "8px 16px" }}>
                Link File
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
