"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import Link from "next/link"
import {
  CARD_BG, CARD_BORDER, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_TERTIARY,
  ROSE_GOLD, GREEN, AMBER, QUICK_ACTIONS, timeAgo,
} from "./constants"
import type { ChatMessage, ActionBlock } from "./types"

interface ChatSectionProps {
  onRefresh: () => void
  initialPrompt?: string
}

/* ── Markdown-lite renderer for AI responses ── */
function renderContent(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  const lines = text.split("\n")
  let inActionBlock = false
  let actionJson = ""

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Skip action-json blocks (they're rendered as buttons separately)
    if (line.trim().startsWith("```action-json")) { inActionBlock = true; actionJson = ""; continue }
    if (inActionBlock) {
      if (line.trim() === "```") { inActionBlock = false; continue }
      actionJson += line
      continue
    }

    // Headers
    if (line.startsWith("### ")) {
      nodes.push(<h4 key={i} style={{ fontSize: 13, fontWeight: 600, color: TEXT_PRIMARY, marginTop: 12, marginBottom: 4, fontFamily: "'DM Sans', sans-serif" }}>{line.slice(4)}</h4>)
      continue
    }
    if (line.startsWith("## ")) {
      nodes.push(<h3 key={i} style={{ fontSize: 14, fontWeight: 600, color: TEXT_PRIMARY, marginTop: 14, marginBottom: 4, fontFamily: "'Bellfair', serif" }}>{line.slice(3)}</h3>)
      continue
    }

    // Bullet points
    if (line.match(/^[-*]\s/)) {
      const content = line.slice(2)
      nodes.push(
        <div key={i} style={{ display: "flex", gap: 8, marginBottom: 3, paddingLeft: 4 }}>
          <span style={{ color: ROSE_GOLD, fontSize: 10, marginTop: 3, flexShrink: 0 }}>◆</span>
          <span style={{ fontSize: 12, color: TEXT_SECONDARY, lineHeight: 1.5 }}>{renderInline(content)}</span>
        </div>
      )
      continue
    }

    // Numbered list
    if (line.match(/^\d+\.\s/)) {
      const match = line.match(/^(\d+)\.\s(.*)/)
      if (match) {
        nodes.push(
          <div key={i} style={{ display: "flex", gap: 8, marginBottom: 3, paddingLeft: 4 }}>
            <span style={{ color: ROSE_GOLD, fontSize: 10, fontWeight: 600, marginTop: 2, flexShrink: 0, width: 16, textAlign: "right" }}>{match[1]}.</span>
            <span style={{ fontSize: 12, color: TEXT_SECONDARY, lineHeight: 1.5 }}>{renderInline(match[2])}</span>
          </div>
        )
        continue
      }
    }

    // Divider
    if (line.trim() === "---" || line.trim() === "***") {
      nodes.push(<hr key={i} style={{ border: "none", borderTop: `1px solid ${CARD_BORDER}`, margin: "10px 0" }} />)
      continue
    }

    // Empty line = spacer
    if (line.trim() === "") {
      nodes.push(<div key={i} style={{ height: 6 }} />)
      continue
    }

    // Regular paragraph
    nodes.push(<p key={i} style={{ fontSize: 12, color: TEXT_SECONDARY, lineHeight: 1.6, margin: "2px 0" }}>{renderInline(line)}</p>)
  }

  return nodes
}

function renderInline(text: string): React.ReactNode {
  // Bold: **text**
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} style={{ color: ROSE_GOLD, fontWeight: 600 }}>{part.slice(2, -2)}</strong>
    }
    // Inline code: `text`
    if (part.includes("`")) {
      const codeParts = part.split(/(`[^`]+`)/g)
      return codeParts.map((cp, j) => {
        if (cp.startsWith("`") && cp.endsWith("`")) {
          return <code key={`${i}-${j}`} style={{ background: "rgba(255,255,255,0.06)", padding: "1px 5px", borderRadius: 4, fontSize: 11, fontFamily: "monospace", color: TEXT_PRIMARY }}>{cp.slice(1, -1)}</code>
        }
        return cp
      })
    }
    return part
  })
}

export default function ChatSection({ onRefresh, initialPrompt }: ChatSectionProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [inputFocused, setInputFocused] = useState(false)
  const [initialSent, setInitialSent] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Load existing conversation
  useEffect(() => {
    fetch("/api/ai/conversations")
      .then((r) => r.json())
      .then((data) => {
        if (data.conversation) {
          setConversationId(data.conversation.id)
          setMessages(data.conversation.messages || [])
        }
      })
      .catch(() => {})
  }, [])

  // Auto-send initial prompt from CRM "Ask Sentinel" button
  useEffect(() => {
    if (initialPrompt && !initialSent && messages.length === 0 && !sending) {
      setInitialSent(true)
      sendMessage(initialPrompt)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt, initialSent, messages.length])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const sendMessage = async (text?: string) => {
    const msg = (text || input).trim()
    if (!msg || sending) return
    setInput("")
    setSending(true)

    // Optimistic add user message
    const userMsg: ChatMessage = { role: "user", content: msg, timestamp: new Date().toISOString() }
    setMessages((prev) => [...prev, userMsg])

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, conversationId }),
      })
      const data = await res.json()

      if (data.response) {
        const assistantMsg: ChatMessage = { role: "assistant", content: data.response, timestamp: new Date().toISOString() }
        setMessages((prev) => [...prev, assistantMsg])
        if (data.conversationId) setConversationId(data.conversationId)
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, I encountered an error. Please try again.", timestamp: new Date().toISOString() }])
    }
    setSending(false)
  }

  const handleQuickAction = (prompt: string) => {
    if (prompt.endsWith(" ")) {
      setInput(prompt)
      inputRef.current?.focus()
    } else {
      sendMessage(prompt)
    }
  }

  const clearChat = () => {
    setMessages([])
    setConversationId(null)
  }

  // Parse action blocks from message
  const parseActions = (text: string): ActionBlock[] => {
    const actions: ActionBlock[] = []
    const regex = /```action-json\s*\n([\s\S]*?)\n```/g
    let match
    while ((match = regex.exec(text)) !== null) {
      try {
        const parsed = JSON.parse(match[1].trim())
        if (parsed.action) actions.push(parsed)
      } catch { /* skip */ }
    }
    return actions
  }

  const executeAction = async (action: ActionBlock) => {
    try {
      if (action.action === "create_task") {
        await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: action.data.title,
            assignee: action.data.assignee || null,
            priority: action.data.priority || "medium",
            status: "todo",
          }),
        })
        onRefresh()
      } else if (action.action === "add_note" && action.data.contactId) {
        await fetch(`/api/contacts/${action.data.contactId}/interactions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "note",
            content: action.data.content || action.data.note || "",
          }),
        })
        onRefresh()
      } else if (action.action === "update_deal" && action.data.dealId) {
        const body: Record<string, unknown> = {}
        if (action.data.stage) body.stage = action.data.stage
        if (action.data.probability) body.probability = action.data.probability
        if (action.data.notes) body.notes = action.data.notes
        await fetch(`/api/deals/${action.data.dealId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        onRefresh()
      }
    } catch { /* silent */ }
  }

  return (
    <div style={{
      background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 16,
      display: "flex", flexDirection: "column", height: "clamp(380px, 42vh, 520px)", overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        padding: "12px 18px", borderBottom: `1px solid ${CARD_BORDER}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>{"\uD83D\uDEE1\uFE0F"}</span>
          <span style={{
            fontSize: 13, fontWeight: 500, fontFamily: "'DM Sans', sans-serif",
            background: "linear-gradient(90deg, #C08B88, #E8C4C0)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>
            Sentinel
          </span>
        </div>
        {messages.length > 0 && (
          <button onClick={clearChat} style={{
            background: "none", border: `1px solid ${CARD_BORDER}`, borderRadius: 6,
            padding: "3px 10px", fontSize: 9, color: TEXT_TERTIARY, cursor: "pointer",
            fontFamily: "'DM Sans', sans-serif",
          }}>
            New Chat
          </button>
        )}
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflow: "auto", padding: "14px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
        {messages.length === 0 && !sending && (
          <div style={{ textAlign: "center", padding: "40px 20px", color: TEXT_TERTIARY }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>{"\uD83D\uDEE1\uFE0F"}</div>
            <div style={{ fontSize: 14, fontFamily: "'Bellfair', serif", color: TEXT_SECONDARY, marginBottom: 6 }}>
              Sentinel
            </div>
            <div style={{ fontSize: 11, lineHeight: 1.6, maxWidth: 340, margin: "0 auto" }}>
              Research companies, prepare meetings, identify opportunities, and manage your pipeline — all powered by your CRM data.
            </div>
          </div>
        )}

        {messages.map((msg, idx) => {
          const isUser = msg.role === "user"
          const actions = !isUser ? parseActions(msg.content) : []

          return (
            <div key={idx} style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start" }}>
              <div style={{
                maxWidth: isUser ? "65%" : "85%",
                padding: isUser ? "8px 14px" : "12px 16px",
                borderRadius: 14,
                ...(isUser
                  ? { background: "rgba(255,255,255,0.05)", borderTopRightRadius: 4 }
                  : { background: "rgba(192,139,136,0.04)", border: `1px solid rgba(192,139,136,0.08)`, borderTopLeftRadius: 4 }),
              }}>
                {isUser ? (
                  <div style={{ fontSize: 12, color: TEXT_PRIMARY, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                    {msg.content}
                  </div>
                ) : (
                  <>
                    {renderContent(msg.content)}
                    {actions.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10, paddingTop: 8, borderTop: `1px solid ${CARD_BORDER}` }}>
                        {actions.map((a, ai) => (
                          <button
                            key={ai}
                            onClick={() => executeAction(a)}
                            style={{
                              padding: "4px 12px", borderRadius: 6, fontSize: 10, fontWeight: 500,
                              fontFamily: "'DM Sans', sans-serif", cursor: "pointer",
                              border: `1px solid rgba(192,139,136,0.3)`,
                              background: "rgba(192,139,136,0.08)", color: ROSE_GOLD,
                            }}
                          >
                            {a.action === "create_task" ? `\u2705 Create Task: ${(a.data.title as string)?.substring(0, 30)}` :
                             a.action === "add_note" ? `\uD83D\uDCDD Add Note to Contact` :
                             a.action === "update_deal" ? `\uD83D\uDCC8 Update Deal${a.data.stage ? ` \u2192 ${a.data.stage}` : ""}` : a.action}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
                <div style={{ fontSize: 8, color: TEXT_TERTIARY, marginTop: 4, textAlign: isUser ? "right" : "left" }}>
                  {timeAgo(msg.timestamp)}
                </div>
              </div>
            </div>
          )
        })}

        {sending && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div className="ai-shimmer" style={{
              padding: "16px 20px", borderRadius: 14, borderTopLeftRadius: 4,
              width: 200, height: 48,
            }} />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick actions + input */}
      <div style={{ padding: "8px 18px 14px", borderTop: `1px solid ${CARD_BORDER}` }}>
        {messages.length === 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
            {QUICK_ACTIONS.map((qa) => (
              <button
                key={qa.label}
                onClick={() => handleQuickAction(qa.prompt)}
                style={{
                  padding: "5px 12px", borderRadius: 20, fontSize: 10,
                  fontFamily: "'DM Sans', sans-serif", cursor: "pointer",
                  border: `1px solid ${CARD_BORDER}`, background: "rgba(255,255,255,0.02)",
                  color: TEXT_SECONDARY, transition: "all 0.15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(192,139,136,0.3)"; e.currentTarget.style.color = ROSE_GOLD }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = CARD_BORDER; e.currentTarget.style.color = TEXT_SECONDARY }}
              >
                {qa.label}
              </button>
            ))}
          </div>
        )}

        <div style={{
          display: "flex", gap: 8, alignItems: "flex-end",
          padding: 3, borderRadius: 14,
          background: inputFocused
            ? "linear-gradient(135deg, rgba(192,139,136,0.12), rgba(232,196,192,0.06))"
            : "transparent",
          border: `1px solid ${inputFocused ? "rgba(192,139,136,0.3)" : CARD_BORDER}`,
          transition: "all 0.2s",
        }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage() }
            }}
            placeholder="Ask Sentinel anything... research a company, prepare a meeting, find opportunities"
            rows={1}
            style={{
              flex: 1, background: "transparent", border: "none", outline: "none",
              color: TEXT_PRIMARY, fontSize: 12, fontFamily: "'DM Sans', sans-serif",
              padding: "8px 10px", resize: "none", lineHeight: 1.5,
            }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={sending || !input.trim()}
            style={{
              padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer",
              background: input.trim() ? "linear-gradient(135deg, #C08B88, #8B6B68)" : "rgba(255,255,255,0.04)",
              color: input.trim() ? "#FFF" : TEXT_TERTIARY,
              fontSize: 11, fontWeight: 500, fontFamily: "'DM Sans', sans-serif",
              transition: "all 0.2s", flexShrink: 0,
            }}
          >
            {sending ? "..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  )
}
