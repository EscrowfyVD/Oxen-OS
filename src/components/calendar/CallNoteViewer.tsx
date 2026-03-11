"use client"

import { useEffect, useRef, useCallback } from "react"

interface CallNoteViewerProps {
  callNoteId: string
  htmlContent: string
  savedData?: Record<string, unknown>
  onSaveData?: (data: Record<string, unknown>) => void
}

export default function CallNoteViewer({
  callNoteId,
  htmlContent,
  savedData,
  onSaveData,
}: CallNoteViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // Listen for messages from iframe
  const handleMessage = useCallback(
    (event: MessageEvent) => {
      if (event.data?.type === "SAVE_NOTE_DATA" && onSaveData) {
        onSaveData(event.data.data)
      }
    },
    [onSaveData]
  )

  useEffect(() => {
    window.addEventListener("message", handleMessage)
    return () => window.removeEventListener("message", handleMessage)
  }, [handleMessage])

  // Inject saved data back into iframe on load
  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe || !savedData) return

    const handleLoad = () => {
      iframe.contentWindow?.postMessage(
        {
          type: "LOAD_NOTE_DATA",
          data: savedData,
        },
        "*"
      )
    }

    iframe.addEventListener("load", handleLoad)
    return () => iframe.removeEventListener("load", handleLoad)
  }, [savedData])

  return (
    <div
      className="card overflow-hidden"
      style={{
        border: "1px solid var(--border)",
        height: "calc(100vh - 200px)",
      }}
    >
      <div
        className="px-4 py-2 text-xs font-semibold flex items-center justify-between"
        style={{
          borderBottom: "1px solid var(--border)",
          background: "var(--bg-elevated)",
          color: "var(--text-mid)",
        }}
      >
        <span>Call Note Viewer</span>
        <span style={{ color: "var(--text-dim)" }}>ID: {callNoteId}</span>
      </div>
      <iframe
        ref={iframeRef}
        srcDoc={htmlContent}
        className="w-full border-none"
        style={{
          height: "calc(100% - 36px)",
          background: "#fff",
        }}
        title="Call Note"
        sandbox="allow-scripts allow-same-origin"
      />
    </div>
  )
}
