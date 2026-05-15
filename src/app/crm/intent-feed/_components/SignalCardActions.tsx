"use client"

import { useState } from "react"
import Link from "next/link"
import { CRM_COLORS } from "@/lib/crm-config"
import CreateTaskFromSignalModal from "./CreateTaskFromSignalModal"
import SendTelegramModal from "./SendTelegramModal"
import type { IntentFeedSignalView } from "./types"

const TEXT2 = CRM_COLORS.text_secondary
const CARD_BORDER = CRM_COLORS.card_border

const actionBtn: React.CSSProperties = {
  background: "transparent",
  border: `1px solid ${CARD_BORDER}`,
  borderRadius: 6,
  padding: "6px 12px",
  fontSize: 11,
  color: TEXT2,
  fontFamily: "'DM Sans', sans-serif",
  cursor: "pointer",
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
}

interface SignalCardActionsProps {
  signal: IntentFeedSignalView
  onActioned: (signalId: string, actionedAt: string, actionedBy: string | null) => void
  onSuccess: (message: string) => void
}

export default function SignalCardActions({
  signal,
  onActioned,
  onSuccess,
}: SignalCardActionsProps) {
  const [isActioning, setIsActioning] = useState(false)
  const [taskModalOpen, setTaskModalOpen] = useState(false)
  const [tgModalOpen, setTgModalOpen] = useState(false)

  const isActioned = !!signal.actionedAt

  async function markActioned() {
    if (isActioning || isActioned) return
    setIsActioning(true)
    try {
      const res = await fetch(`/api/intent-feed/${signal.id}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "mark_actioned" }),
      })
      const data = await res.json()
      if (!res.ok) {
        onSuccess(`Failed to mark actioned: ${data.error || "Unknown"}`)
        return
      }
      onActioned(signal.id, data.actioned_at, data.actioned_by ?? null)
      onSuccess("Signal marked as actioned")
    } catch {
      onSuccess("Network error marking actioned")
    } finally {
      setIsActioning(false)
    }
  }

  return (
    <>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {signal.contact && (
          <Link href={`/crm/contacts/${signal.contact.id}`} style={actionBtn}>
            View contact
          </Link>
        )}
        <button
          style={actionBtn}
          onClick={() => setTaskModalOpen(true)}
          disabled={isActioned}
        >
          Create task
        </button>
        <button
          style={actionBtn}
          onClick={() => setTgModalOpen(true)}
          disabled={isActioned}
        >
          Send Telegram
        </button>
        <button
          style={{
            ...actionBtn,
            background: isActioned ? "transparent" : "rgba(52,211,153,0.08)",
            borderColor: isActioned ? CARD_BORDER : "rgba(52,211,153,0.35)",
            color: isActioned ? TEXT2 : "#34D399",
            cursor: isActioning || isActioned ? "default" : "pointer",
            opacity: isActioning ? 0.6 : 1,
          }}
          onClick={markActioned}
          disabled={isActioning || isActioned}
        >
          {isActioned ? "Actioned" : isActioning ? "…" : "Mark actioned"}
        </button>
      </div>

      {taskModalOpen && (
        <CreateTaskFromSignalModal
          signal={signal}
          onClose={() => setTaskModalOpen(false)}
          onSuccess={(msg) => {
            setTaskModalOpen(false)
            onSuccess(msg)
          }}
        />
      )}

      {tgModalOpen && (
        <SendTelegramModal
          signal={signal}
          onClose={() => setTgModalOpen(false)}
          onSuccess={(msg) => {
            setTgModalOpen(false)
            onSuccess(msg)
          }}
        />
      )}
    </>
  )
}
