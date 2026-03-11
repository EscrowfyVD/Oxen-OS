"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams } from "next/navigation"
import PageHeader from "@/components/layout/PageHeader"
import CallNoteViewer from "@/components/calendar/CallNoteViewer"
import Link from "next/link"

interface CallNote {
  id: string
  title: string
  htmlContent: string
  eventId: string
  createdAt: string
  noteData?: Record<string, unknown>
}

export default function CallNotePage() {
  const params = useParams()
  const id = params?.id as string
  const [callNote, setCallNote] = useState<CallNote | null>(null)
  const [savedData, setSavedData] = useState<Record<string, unknown> | undefined>(
    undefined
  )

  useEffect(() => {
    if (!id) return
    fetch(`/api/call-notes/${id}`)
      .then((r) => r.json())
      .then((data) => {
        const note = data.callNote ?? data
        setCallNote(note)
        if (note.noteData) {
          setSavedData(note.noteData)
        }
      })
      .catch(() => {})
  }, [id])

  const handleSaveData = useCallback(
    async (data: Record<string, unknown>) => {
      setSavedData(data)
      try {
        await fetch(`/api/call-notes/${id}/data`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        })
      } catch {
        // handle error silently
      }
    },
    [id]
  )

  if (!callNote) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-sm" style={{ color: "var(--text-dim)" }}>
          Loading call note...
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title={callNote.title || "Call Note"}
        description={`Created ${new Date(callNote.createdAt).toLocaleDateString(
          "en-US",
          {
            month: "long",
            day: "numeric",
            year: "numeric",
          }
        )}`}
        actions={
          <Link
            href="/calendar"
            className="px-4 py-2 rounded-lg text-sm font-semibold no-underline"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              color: "var(--text)",
            }}
          >
            Back to Calendar
          </Link>
        }
      />

      <CallNoteViewer
        callNoteId={callNote.id}
        htmlContent={callNote.htmlContent}
        savedData={savedData}
        onSaveData={handleSaveData}
      />
    </div>
  )
}
