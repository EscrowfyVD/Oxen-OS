"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useParams, useRouter } from "next/navigation"

interface CallNote {
  id: string
  title: string
  date: string
  htmlContent: string
  eventId: string | null
  createdAt: string
  noteData?: Record<string, unknown>
}

export default function CallNotePage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const [callNote, setCallNote] = useState<CallNote | null>(null)
  const [loading, setLoading] = useState(true)
  const [savedData, setSavedData] = useState<Record<string, unknown> | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Fetch call note
  useEffect(() => {
    if (!id) return
    fetch(`/api/call-notes/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("Not found")
        return r.json()
      })
      .then((data) => {
        const note = data.note ?? data.callNote ?? data
        setCallNote(note)
        if (note.noteData) {
          setSavedData(note.noteData)
        }
        setLoading(false)
      })
      .catch(() => {
        router.replace("/calendar")
      })
  }, [id, router])

  // PostMessage listener — save data from iframe
  const handleMessage = useCallback(
    (event: MessageEvent) => {
      if (event.data?.type === "SAVE_NOTE_DATA") {
        const data = event.data.data
        setSavedData(data)
        // Persist to DB
        fetch(`/api/call-notes/${id}/data`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ noteData: data }),
        }).catch(() => {})
      }
      if (event.data?.type === "NOTES_READY") {
        // Send saved data to iframe
        if (savedData && iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage(
            { type: "LOAD_NOTE_DATA", data: savedData },
            "*"
          )
        }
      }
    },
    [id, savedData]
  )

  useEffect(() => {
    window.addEventListener("message", handleMessage)
    return () => window.removeEventListener("message", handleMessage)
  }, [handleMessage])

  // Fallback: send data on iframe load
  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe || !savedData) return

    const handleLoad = () => {
      setTimeout(() => {
        iframe.contentWindow?.postMessage(
          { type: "LOAD_NOTE_DATA", data: savedData },
          "*"
        )
      }, 200)
    }

    iframe.addEventListener("load", handleLoad)
    return () => iframe.removeEventListener("load", handleLoad)
  }, [savedData])

  const handleOpenNewTab = () => {
    if (!callNote) return
    const blob = new Blob([callNote.htmlContent], { type: "text/html" })
    const url = URL.createObjectURL(blob)
    window.open(url, "_blank")
  }

  const handleDelete = async () => {
    if (!confirm("Delete these call notes? This cannot be undone.")) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/call-notes/${id}`, { method: "DELETE" })
      if (res.ok) {
        router.push("/calendar")
      }
    } catch {
      setDeleting(false)
    }
  }

  if (loading || !callNote) {
    return (
      <div
        style={{
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--void)",
        }}
      >
        <div style={{ fontSize: 13, color: "var(--text-tertiary)" }}>
          Loading call notes...
        </div>
      </div>
    )
  }

  const formattedDate = new Date(callNote.date).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  })

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "var(--void)" }}>
      {/* Thin header bar */}
      <header
        style={{
          height: 48,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
          background: "var(--card-bg-solid)",
          borderBottom: "1px solid var(--card-border)",
          zIndex: 100,
        }}
      >
        {/* Left — Back + Title */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <button
            onClick={() => router.push("/calendar")}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-secondary)",
              fontSize: 13,
              fontFamily: "'DM Sans', sans-serif",
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "4px 8px",
              borderRadius: 6,
              transition: "color 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "#C08B88" }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "" }}
          >
            {"\u2190"} Calendar
          </button>

          <div
            style={{
              width: 1,
              height: 20,
              background: "var(--card-border)",
            }}
          />

          <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "var(--text-primary)",
                fontFamily: "'DM Sans', sans-serif",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {callNote.title}
            </span>
            <span
              style={{
                fontSize: 11,
                color: "var(--text-tertiary)",
                fontFamily: "'DM Sans', sans-serif",
                flexShrink: 0,
              }}
            >
              {formattedDate}
            </span>
          </div>
        </div>

        {/* Right — Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <button
            onClick={handleOpenNewTab}
            style={{
              background: "var(--surface-elevated)",
              border: "1px solid var(--card-border)",
              cursor: "pointer",
              color: "var(--text-secondary)",
              fontSize: 11,
              fontFamily: "'DM Sans', sans-serif",
              fontWeight: 500,
              padding: "5px 12px",
              borderRadius: 6,
              transition: "all 0.15s",
            }}
          >
            {"\u2197"} Open in new tab
          </button>

          <button
            onClick={handleDelete}
            disabled={deleting}
            style={{
              background: "rgba(239,68,68,0.06)",
              border: "1px solid rgba(239,68,68,0.12)",
              cursor: deleting ? "wait" : "pointer",
              color: "#EF4444",
              fontSize: 11,
              fontFamily: "'DM Sans', sans-serif",
              fontWeight: 500,
              padding: "5px 12px",
              borderRadius: 6,
              opacity: deleting ? 0.5 : 1,
              transition: "all 0.15s",
            }}
          >
            {deleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </header>

      {/* Full-screen iframe */}
      <iframe
        ref={iframeRef}
        srcDoc={callNote.htmlContent}
        style={{
          flex: 1,
          width: "100%",
          border: "none",
          background: "var(--void)",
        }}
        title={callNote.title}
        sandbox="allow-scripts allow-same-origin"
      />
    </div>
  )
}
