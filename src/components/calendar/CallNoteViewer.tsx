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
    <div className="card" style={{ overflow: "hidden", height: "calc(100vh - 200px)" }}>
      <div
        className="card-header flex items-center justify-between"
        style={{ padding: "10px 20px" }}
      >
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 14 }}>{"\uD83D\uDCCB"}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
            Call Note Viewer
          </span>
        </div>
        <span style={{ fontSize: 10, color: "var(--text-dim)" }}>
          ID: {callNoteId}
        </span>
      </div>
      <iframe
        ref={iframeRef}
        srcDoc={htmlContent}
        className="w-full border-none"
        style={{
          height: "calc(100% - 44px)",
          background: "#0F1419",
        }}
        title="Call Note"
        sandbox="allow-scripts allow-same-origin"
      />
    </div>
  )
}
