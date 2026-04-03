"use client"

import { useState, useEffect, useCallback } from "react"
import { PIPELINE_STAGES, CRM_COLORS, STAGE_LABELS } from "@/lib/crm-config"

/* ── Design Tokens ── */
const CARD_BG = "rgba(15,17,24,0.6)"
const CARD_BORDER = "rgba(255,255,255,0.06)"
const TEXT = "#F0F0F2"
const TEXT_SEC = "rgba(240,240,242,0.55)"
const ROSE = "#C08B88"
const GREEN = "#34D399"

const GLASS: React.CSSProperties = {
  background: CARD_BG,
  border: `1px solid ${CARD_BORDER}`,
  borderRadius: 14,
  backdropFilter: CRM_COLORS.glass_blur,
  WebkitBackdropFilter: CRM_COLORS.glass_blur,
  boxShadow: CRM_COLORS.glass_shadow,
}

/* ── Types ── */
interface PlaybookStep {
  id: string
  dealId: string
  stage: string
  title: string
  description: string | null
  isCompleted: boolean
  completedAt: string | null
  completedBy: string | null
  isBlocking: boolean
  order: number
}

interface Props {
  dealId: string
  currentStage: string
}

/* ── Helpers ── */
const stageOrder = PIPELINE_STAGES.map((s) => s.id)

function getStageIndex(stage: string): number {
  const idx = stageOrder.indexOf(stage as typeof stageOrder[number])
  return idx === -1 ? 999 : idx
}

function getNextStageLabel(currentStage: string): string | null {
  const idx = getStageIndex(currentStage)
  if (idx >= stageOrder.length - 1) return null
  const next = stageOrder[idx + 1]
  return STAGE_LABELS[next] ?? null
}

/* ── Component ── */
export default function PlaybookSidebar({ dealId, currentStage }: Props) {
  const [steps, setSteps] = useState<PlaybookStep[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set([currentStage]))

  const currentIdx = getStageIndex(currentStage)

  /* ── Fetch all steps ── */
  const fetchSteps = useCallback(async () => {
    try {
      const res = await fetch(`/api/crm/playbook/${dealId}`)
      const data = await res.json()
      const fetched: PlaybookStep[] = data.steps ?? []

      // Check if current stage has steps; if not, auto-initialize
      const hasCurrentStage = fetched.some((s) => s.stage === currentStage)
      if (!hasCurrentStage) {
        const initRes = await fetch(`/api/crm/playbook/${dealId}/init`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stage: currentStage }),
        })
        const initData = await initRes.json()
        const newSteps: PlaybookStep[] = initData.steps ?? []
        setSteps([...fetched, ...newSteps])
      } else {
        setSteps(fetched)
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [dealId, currentStage])

  useEffect(() => {
    fetchSteps()
  }, [fetchSteps])

  /* ── Toggle step completion (optimistic) ── */
  const toggleStep = async (step: PlaybookStep) => {
    const newVal = !step.isCompleted
    // Optimistic update
    setSteps((prev) =>
      prev.map((s) =>
        s.id === step.id
          ? { ...s, isCompleted: newVal, completedAt: newVal ? new Date().toISOString() : null }
          : s
      )
    )
    try {
      await fetch(`/api/crm/playbook/step/${step.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isCompleted: newVal }),
      })
    } catch {
      // Revert on error
      setSteps((prev) =>
        prev.map((s) =>
          s.id === step.id
            ? { ...s, isCompleted: !newVal, completedAt: step.completedAt }
            : s
        )
      )
    }
  }

  /* ── Toggle stage expand/collapse ── */
  const toggleStage = (stage: string) => {
    setExpandedStages((prev) => {
      const next = new Set(prev)
      if (next.has(stage)) next.delete(stage)
      else next.add(stage)
      return next
    })
  }

  /* ── Group steps by stage ── */
  const stageGroups = PIPELINE_STAGES
    .map((ps) => ({
      stageId: ps.id,
      label: ps.label,
      color: ps.color,
      steps: steps.filter((s) => s.stage === ps.id).sort((a, b) => a.order - b.order),
    }))
    .filter((g) => g.steps.length > 0)

  /* ── Overall progress ── */
  const currentStageSteps = steps.filter((s) => s.stage === currentStage)
  const completedCount = currentStageSteps.filter((s) => s.isCompleted).length
  const totalCount = currentStageSteps.length
  const progressPct = totalCount > 0 ? (completedCount / totalCount) * 100 : 0
  const allCurrentDone = totalCount > 0 && completedCount === totalCount

  const nextLabel = getNextStageLabel(currentStage)

  if (loading) {
    return (
      <div style={{ ...GLASS, padding: 24 }}>
        <div style={{ color: TEXT_SEC, fontSize: 13, fontFamily: "'DM Sans', sans-serif" }}>
          Loading playbook...
        </div>
      </div>
    )
  }

  return (
    <div style={{ ...GLASS, padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
      {/* ── Header ── */}
      <div>
        <h3
          style={{
            margin: 0,
            fontSize: 15,
            fontWeight: 600,
            color: TEXT,
            fontFamily: "'DM Sans', sans-serif",
            letterSpacing: 0.2,
          }}
        >
          Sales Playbook
        </h3>
        <div
          style={{
            marginTop: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 12,
            color: TEXT_SEC,
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          <span>
            {completedCount}/{totalCount} completed
          </span>
          <span style={{ color: TEXT_SEC, fontSize: 11 }}>
            {STAGE_LABELS[currentStage] ?? currentStage}
          </span>
        </div>
        {/* Progress bar */}
        <div
          style={{
            marginTop: 6,
            height: 3,
            borderRadius: 2,
            background: "rgba(255,255,255,0.08)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${progressPct}%`,
              background: GREEN,
              borderRadius: 2,
              transition: "width 0.3s ease",
            }}
          />
        </div>
      </div>

      {/* ── Ready to advance prompt ── */}
      {allCurrentDone && nextLabel && (
        <div
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            background: `${ROSE}14`,
            border: `1px solid ${ROSE}30`,
            fontSize: 12,
            color: ROSE,
            fontFamily: "'DM Sans', sans-serif",
            fontWeight: 500,
          }}
        >
          Ready to advance to {nextLabel}?
        </div>
      )}

      {/* ── Stage Groups ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {stageGroups.map((group) => {
          const groupIdx = getStageIndex(group.stageId)
          const isCurrent = group.stageId === currentStage
          const isPast = groupIdx < currentIdx
          const isFuture = groupIdx > currentIdx
          const isExpanded = expandedStages.has(group.stageId)
          const groupCompleted = group.steps.filter((s) => s.isCompleted).length
          const groupTotal = group.steps.length
          const allDone = groupCompleted === groupTotal

          return (
            <div key={group.stageId}>
              {/* Stage header */}
              <button
                onClick={() => !isFuture && toggleStage(group.stageId)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  width: "100%",
                  padding: "6px 8px",
                  background: isCurrent ? "rgba(255,255,255,0.04)" : "transparent",
                  border: "none",
                  borderRadius: 8,
                  cursor: isFuture ? "default" : "pointer",
                  opacity: isFuture ? 0.35 : 1,
                  transition: "background 0.15s",
                }}
              >
                {/* Status indicator */}
                <span style={{ fontSize: 12 }}>
                  {isPast && allDone ? "✅" : isPast ? "⚠️" : isFuture ? "🔒" : "▸"}
                </span>
                <span
                  style={{
                    flex: 1,
                    textAlign: "left",
                    fontSize: 12,
                    fontWeight: isCurrent ? 600 : 400,
                    color: isCurrent ? TEXT : TEXT_SEC,
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  {group.label}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    color: TEXT_SEC,
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  {groupCompleted}/{groupTotal}
                </span>
              </button>

              {/* Steps list */}
              {isExpanded && !isFuture && (
                <div
                  style={{
                    marginLeft: 16,
                    marginTop: 4,
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                  }}
                >
                  {group.steps.map((step) => (
                    <div
                      key={step.id}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 8,
                        padding: "5px 6px",
                        borderRadius: 6,
                        cursor: isCurrent ? "pointer" : "default",
                        transition: "background 0.12s",
                      }}
                      onClick={() => isCurrent && toggleStep(step)}
                      onMouseEnter={(e) => {
                        if (isCurrent) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.background = "transparent"
                      }}
                    >
                      {/* Checkbox */}
                      <div
                        style={{
                          width: 16,
                          height: 16,
                          flexShrink: 0,
                          marginTop: 1,
                          borderRadius: 4,
                          border: step.isCompleted
                            ? `2px solid ${GREEN}`
                            : `2px solid rgba(255,255,255,0.15)`,
                          background: step.isCompleted ? `${GREEN}20` : "transparent",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 10,
                          transition: "all 0.15s",
                        }}
                      >
                        {step.isCompleted && (
                          <span style={{ color: GREEN, fontWeight: 700 }}>✓</span>
                        )}
                      </div>

                      {/* Title + description */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 12,
                            color: step.isCompleted ? TEXT_SEC : TEXT,
                            fontFamily: "'DM Sans', sans-serif",
                            textDecoration: step.isCompleted ? "line-through" : "none",
                            lineHeight: 1.4,
                          }}
                        >
                          {step.title}
                          {step.isBlocking && !step.isCompleted && (
                            <span
                              style={{
                                marginLeft: 5,
                                fontSize: 10,
                                color: "#F87171",
                              }}
                              title="Blocking step — must complete before advancing"
                            >
                              🔒
                            </span>
                          )}
                        </div>
                        {step.description && (
                          <div
                            style={{
                              fontSize: 11,
                              color: TEXT_SEC,
                              fontFamily: "'DM Sans', sans-serif",
                              marginTop: 2,
                              lineHeight: 1.3,
                            }}
                          >
                            {step.description}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
