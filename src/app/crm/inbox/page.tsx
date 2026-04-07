"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Inbox, Mail, Calendar, MessageSquare, RefreshCw } from "lucide-react"
import {
  STAGE_LABELS,
  STAGE_COLORS as PIPELINE_STAGE_COLORS,
  ACTIVITY_ICONS,
  CRM_COLORS,
} from "@/lib/crm-config"

/* ── Tokens ── */
const CARD_BG = CRM_COLORS.card_bg
const CARD_BORDER = CRM_COLORS.card_border
const TEXT_PRIMARY = CRM_COLORS.text_primary
const TEXT_SECONDARY = CRM_COLORS.text_secondary
const TEXT_TERTIARY = CRM_COLORS.text_tertiary
const ROSE_GOLD = CRM_COLORS.rose_gold
const GLASS_BLUR = CRM_COLORS.glass_blur
const GLASS_SHADOW = CRM_COLORS.glass_shadow

/* ── Types ── */
interface InboxActivity {
  id: string
  type: string
  title: string | null
  notes: string | null
  createdAt: string
  contact: {
    id: string
    firstName: string | null
    lastName: string | null
    email: string | null
    jobTitle: string | null
    company: { id: string; name: string } | null
  } | null
  deal: {
    id: string
    dealName: string
    stage: string
  } | null
}

const CHANNEL_ICONS: Record<string, typeof Mail> = {
  email_received: Mail,
  meeting_calendly: Calendar,
  whatsapp_message: MessageSquare,
  clay_sequence_event: RefreshCw,
}

function formatTimeAgo(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return "just now"
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
}

export default function CrmInboxPage() {
  const router = useRouter()
  const [activities, setActivities] = useState<InboxActivity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/crm/inbox?limit=50")
      .then((r) => r.json())
      .then((data) => {
        setActivities(data.activities ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const stageColor = (stage: string) => PIPELINE_STAGE_COLORS[stage] ?? TEXT_TERTIARY
  const stageLabel = (stage: string) => STAGE_LABELS[stage] ?? stage

  return (
    <div style={{ padding: "32px 40px", minHeight: "100vh", background: "var(--void)" }}>
      {/* Header */}
      <div className="flex items-center justify-between" style={{ marginBottom: 28 }}>
        <div>
          <h1
            style={{
              fontFamily: "'Bellfair', serif",
              fontSize: 32,
              color: TEXT_PRIMARY,
              margin: 0,
              lineHeight: 1.2,
            }}
          >
            Inbox
          </h1>
          <p style={{ fontSize: 13, color: TEXT_SECONDARY, marginTop: 4, fontFamily: "'DM Sans', sans-serif" }}>
            {activities.length} recent messages and events
          </p>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: "center", padding: 60, color: TEXT_TERTIARY, fontSize: 14 }}>
          Loading inbox...
        </div>
      )}

      {/* Table */}
      {!loading && activities.length > 0 && (
        <div
          style={{
            background: CARD_BG,
            backdropFilter: GLASS_BLUR,
            border: `1px solid ${CARD_BORDER}`,
            borderRadius: 14,
            boxShadow: GLASS_SHADOW,
            overflow: "hidden",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["", "Contact", "Company", "Message", "Channel", "Time", "Deal Stage"].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: "left",
                      padding: "12px 16px",
                      fontSize: 10,
                      color: TEXT_TERTIARY,
                      textTransform: "uppercase",
                      letterSpacing: 1,
                      fontFamily: "'DM Sans', sans-serif",
                      fontWeight: 500,
                      borderBottom: `1px solid ${CARD_BORDER}`,
                      background: "var(--surface-subtle)",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activities.map((a) => {
                const ChannelIcon = CHANNEL_ICONS[a.type] ?? Mail
                const contactName = a.contact
                  ? [a.contact.firstName, a.contact.lastName].filter(Boolean).join(" ") || a.contact.email || "Unknown"
                  : "Unknown"
                const companyName = a.contact?.company?.name ?? "---"
                const snippet = a.notes || a.title || a.type.replace(/_/g, " ")

                return (
                  <tr
                    key={a.id}
                    onClick={() => {
                      if (a.contact?.id) router.push(`/crm/${a.contact.id}`)
                    }}
                    style={{
                      cursor: a.contact?.id ? "pointer" : "default",
                      transition: "background 0.15s",
                      borderBottom: `1px solid ${CARD_BORDER}`,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-subtle)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    {/* Icon */}
                    <td style={{ padding: "14px 8px 14px 16px", width: 32 }}>
                      <span style={{ fontSize: 16, lineHeight: 1 }}>
                        {ACTIVITY_ICONS[a.type] || "o"}
                      </span>
                    </td>

                    {/* Contact name */}
                    <td style={{ padding: "14px 16px", fontSize: 13, color: TEXT_PRIMARY, fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>
                      {contactName}
                    </td>

                    {/* Company */}
                    <td style={{ padding: "14px 16px", fontSize: 12, color: TEXT_SECONDARY, fontFamily: "'DM Sans', sans-serif" }}>
                      {companyName}
                    </td>

                    {/* Message snippet */}
                    <td style={{ padding: "14px 16px", fontSize: 12, color: TEXT_SECONDARY, fontFamily: "'DM Sans', sans-serif", maxWidth: 300 }}>
                      <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {snippet.length > 100 ? snippet.slice(0, 100) + "..." : snippet}
                      </span>
                    </td>

                    {/* Channel icon */}
                    <td style={{ padding: "14px 16px" }}>
                      <ChannelIcon size={14} strokeWidth={1.8} style={{ color: TEXT_TERTIARY }} />
                    </td>

                    {/* Time */}
                    <td style={{ padding: "14px 16px", fontSize: 11, color: TEXT_TERTIARY, whiteSpace: "nowrap", fontFamily: "'DM Sans', sans-serif" }}>
                      {formatTimeAgo(a.createdAt)}
                    </td>

                    {/* Deal stage badge */}
                    <td style={{ padding: "14px 16px" }}>
                      {a.deal ? (
                        <span
                          style={{
                            display: "inline-block",
                            padding: "2px 8px",
                            borderRadius: 6,
                            fontSize: 10,
                            fontWeight: 500,
                            color: stageColor(a.deal.stage),
                            background: `${stageColor(a.deal.stage)}18`,
                            fontFamily: "'DM Sans', sans-serif",
                          }}
                        >
                          {stageLabel(a.deal.stage)}
                        </span>
                      ) : (
                        <span style={{ fontSize: 11, color: TEXT_TERTIARY }}>---</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty state */}
      {!loading && activities.length === 0 && (
        <div
          style={{
            textAlign: "center",
            padding: "80px 20px",
            color: TEXT_TERTIARY,
            fontSize: 14,
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          <Inbox size={40} strokeWidth={1.2} style={{ color: TEXT_TERTIARY, marginBottom: 12, opacity: 0.5 }} />
          <p>Your inbox is empty</p>
          <p style={{ fontSize: 12, marginTop: 4 }}>New messages and events will appear here</p>
        </div>
      )}
    </div>
  )
}
