"use client"

import { useState, useEffect, useCallback } from "react"
import DriveBrowserModal, { CATEGORY_COLORS } from "./DriveBrowserModal"

const CARD_BORDER = "rgba(255,255,255,0.06)"
const FROST = "#F0F0F2"
const TEXT_SECONDARY = "rgba(240,240,242,0.55)"
const TEXT_TERTIARY = "rgba(240,240,242,0.3)"
const ROSE_GOLD = "#C08B88"
const RED = "#F87171"

interface DriveLink {
  id: string
  driveFileId: string
  fileName: string
  fileUrl: string
  mimeType: string
  iconUrl: string | null
  category: string | null
  createdAt: string
  createdBy: string
}

interface Props {
  /** Which relation to link files to */
  linkType: "wikiPageId" | "contactId" | "agentId" | "entityId"
  linkId: string
  title?: string
}

function getMimeIcon(mimeType: string): string {
  if (mimeType.includes("document") || mimeType.includes("word")) return "\uD83D\uDCC4"
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return "\uD83D\uDCCA"
  if (mimeType.includes("presentation")) return "\uD83D\uDCCA"
  if (mimeType.includes("pdf")) return "\uD83D\uDCC4"
  if (mimeType.includes("image")) return "\uD83D\uDDBC\uFE0F"
  return "\uD83D\uDCC4"
}

export default function DriveDocuments({ linkType, linkId, title }: Props) {
  const [links, setLinks] = useState<DriveLink[]>([])
  const [showBrowser, setShowBrowser] = useState(false)

  const fetchLinks = useCallback(() => {
    fetch(`/api/drive/links?${linkType}=${linkId}`)
      .then((r) => r.json())
      .then((data) => setLinks(data.links ?? []))
      .catch(() => {})
  }, [linkType, linkId])

  useEffect(() => { fetchLinks() }, [fetchLinks])

  const handleSelectFile = async (
    file: { id: string; name: string; mimeType: string; webViewLink: string; iconLink: string },
    category: string
  ) => {
    try {
      await fetch("/api/drive/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          driveFileId: file.id,
          fileName: file.name,
          fileUrl: file.webViewLink,
          mimeType: file.mimeType,
          iconUrl: file.iconLink || null,
          category,
          [linkType]: linkId,
        }),
      })
      setShowBrowser(false)
      fetchLinks()
    } catch { /* silent */ }
  }

  const handleUnlink = async (id: string) => {
    try {
      await fetch(`/api/drive/links/${id}`, { method: "DELETE" })
      fetchLinks()
    } catch { /* silent */ }
  }

  return (
    <div style={{ marginTop: 24 }}>
      {/* Section header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <span style={{
          fontSize: 10, color: TEXT_TERTIARY, textTransform: "uppercase",
          letterSpacing: 1.5, fontFamily: "'DM Sans', sans-serif", fontWeight: 500,
        }}>
          {"\uD83D\uDCC1"} {title || "Drive Documents"}
        </span>
        <button
          onClick={() => setShowBrowser(true)}
          style={{
            padding: "4px 12px", borderRadius: 6,
            border: `1px solid ${CARD_BORDER}`, background: "transparent",
            color: TEXT_SECONDARY, fontFamily: "'DM Sans', sans-serif",
            fontSize: 10, cursor: "pointer", transition: "all 0.15s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(192,139,136,0.3)"; e.currentTarget.style.color = ROSE_GOLD }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = CARD_BORDER; e.currentTarget.style.color = TEXT_SECONDARY }}
        >
          + Link from Drive
        </button>
      </div>

      {/* Linked files */}
      {links.length === 0 && (
        <div style={{
          textAlign: "center", padding: "24px 0", color: TEXT_TERTIARY,
          fontSize: 11, fontFamily: "'DM Sans', sans-serif",
          background: "rgba(255,255,255,0.02)", borderRadius: 8,
          border: `1px solid ${CARD_BORDER}`,
        }}>
          No documents linked yet
        </div>
      )}

      {links.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10 }}>
          {links.map((link) => {
            const catColors = link.category ? CATEGORY_COLORS[link.category] || CATEGORY_COLORS.other : CATEGORY_COLORS.other

            return (
              <div
                key={link.id}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 14px", borderRadius: 8,
                  background: "rgba(255,255,255,0.02)",
                  border: `1px solid ${CARD_BORDER}`,
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(192,139,136,0.15)" }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = CARD_BORDER }}
              >
                <span style={{ fontSize: 20, flexShrink: 0 }}>{getMimeIcon(link.mimeType)}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 12, color: FROST, fontFamily: "'DM Sans', sans-serif",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    fontWeight: 500,
                  }}>
                    {link.fileName}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                    {link.category && (
                      <span style={{
                        fontSize: 8, padding: "1px 6px", borderRadius: 4,
                        background: catColors.bg, color: catColors.text,
                        fontFamily: "'DM Sans', sans-serif", textTransform: "uppercase",
                        fontWeight: 500, letterSpacing: 0.3,
                      }}>
                        {link.category}
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                  <a
                    href={link.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      padding: "4px 8px", borderRadius: 4, fontSize: 9,
                      border: `1px solid rgba(192,139,136,0.2)`, background: "transparent",
                      color: ROSE_GOLD, textDecoration: "none",
                      fontFamily: "'DM Sans', sans-serif", cursor: "pointer",
                    }}
                  >
                    Open
                  </a>
                  <button
                    onClick={() => handleUnlink(link.id)}
                    style={{
                      padding: "4px 6px", borderRadius: 4, fontSize: 9,
                      border: "1px solid rgba(248,113,113,0.15)", background: "transparent",
                      color: RED, fontFamily: "'DM Sans', sans-serif", cursor: "pointer",
                      opacity: 0.6,
                    }}
                  >
                    &times;
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Drive Browser Modal */}
      {showBrowser && (
        <DriveBrowserModal
          onSelect={handleSelectFile}
          onClose={() => setShowBrowser(false)}
        />
      )}
    </div>
  )
}
