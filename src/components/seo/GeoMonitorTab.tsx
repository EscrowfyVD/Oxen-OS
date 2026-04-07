"use client"

import { useState, useEffect, useCallback } from "react"
import { BarChart, ResponsiveContainer, Bar, XAxis, YAxis, Tooltip, Cell } from "recharts"

/* ── Design tokens ── */
const CARD_BG = "var(--card-bg)"
const CARD_BORDER = "var(--card-border)"
const TEXT_PRIMARY = "var(--text-primary)"
const TEXT_SECONDARY = "var(--text-secondary)"
const TEXT_TERTIARY = "var(--text-tertiary)"
const ROSE_GOLD = "#C08B88"
const GREEN = "#34D399"
const AMBER = "#FBBF24"
const RED = "#F87171"
const INDIGO = "#818CF8"
const CYAN = "#22D3EE"

const VERTICAL_COLORS: Record<string, string> = {
  "FinTech / Crypto": INDIGO,
  "Family Office": ROSE_GOLD,
  "CSP / Fiduciaries": AMBER,
  "Luxury Assets": "#A78BFA",
  "iGaming": GREEN,
  "Yacht Brokers": CYAN,
  "Import / Export": "#60A5FA",
}
const VERTICALS = Object.keys(VERTICAL_COLORS)
const PLATFORMS = ["ChatGPT", "Perplexity", "Claude", "Google AI"] as const
type Platform = (typeof PLATFORMS)[number]

/* ── Types ── */
interface PlatformResult {
  platform: Platform
  oxenCited: boolean
  citationContext: string | null
  responseExcerpt: string | null
  competitorsCited: string[]
}
interface GeoPrompt {
  id: string; prompt: string; vertical: string
  lastTested: string | null; results: PlatformResult[]
}
interface GeoReport {
  citationRate: number; citationsThisWeek: number; citationsLastWeek: number
  promptsTested: number
  bestVertical: { name: string; rate: number }
  worstVertical: { name: string; rate: number }
}
interface ShareOfVoiceEntry { company: string; citations: number }

/* ── Shared styles ── */
const glass: React.CSSProperties = {
  background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 14,
  padding: 20, backdropFilter: "blur(20px)", boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
}
const inputBase: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)", border: `1px solid ${CARD_BORDER}`,
  borderRadius: 6, padding: "8px 12px", color: TEXT_PRIMARY, fontSize: 13,
  fontFamily: "'DM Sans', sans-serif", outline: "none", width: "100%",
}
const selectBase: React.CSSProperties = {
  ...inputBase, appearance: "none" as const, cursor: "pointer", paddingRight: 28,
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='rgba(240,240,242,0.3)' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center", width: "auto", minWidth: 160,
}
const lbl: React.CSSProperties = {
  display: "block", fontSize: 10, color: TEXT_TERTIARY, textTransform: "uppercase",
  letterSpacing: 1, marginBottom: 6, fontFamily: "'DM Sans', sans-serif", fontWeight: 500,
}
const bigNum: React.CSSProperties = { fontFamily: "'Bellfair', serif", fontSize: 32, color: TEXT_PRIMARY, lineHeight: 1 }
const dm = "'DM Sans', sans-serif"
const thStyle = (align: string): React.CSSProperties => ({
  padding: "10px 12px", fontSize: 10, fontWeight: 600, color: TEXT_TERTIARY,
  textTransform: "uppercase", letterSpacing: 0.8, fontFamily: dm,
  textAlign: align as React.CSSProperties["textAlign"], borderBottom: `1px solid ${CARD_BORDER}`, whiteSpace: "nowrap",
})

/* ── Helpers ── */
function citedCount(r: PlatformResult[]) { return r.filter((x) => x.oxenCited).length }
function rowTint(n: number, has: boolean) {
  if (!has) return "transparent"
  if (n >= 3) return "rgba(52,211,153,0.04)"
  return n >= 1 ? "rgba(251,191,36,0.04)" : "rgba(248,113,113,0.04)"
}
function collectCompetitors(r: PlatformResult[]) {
  const s = new Set<string>(); r.forEach((x) => x.competitorsCited?.forEach((c) => s.add(c))); return [...s]
}

/* ══════════════════════════════════════════════════════════════════ */
export default function GeoMonitorTab() {
  const [prompts, setPrompts] = useState<GeoPrompt[]>([])
  const [geoReport, setGeoReport] = useState<GeoReport | null>(null)
  const [shareOfVoice, setShareOfVoice] = useState<ShareOfVoiceEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [runningTests, setRunningTests] = useState(false)
  const [expandedPromptId, setExpandedPromptId] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [verticalFilter, setVerticalFilter] = useState("")

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [rptRes, pRes, sovRes] = await Promise.all([
        fetch("/api/seo/reports/geo"), fetch("/api/seo/geo/prompts"), fetch("/api/seo/geo/share-of-voice"),
      ])
      if (rptRes.ok) setGeoReport(await rptRes.json())
      if (pRes.ok) { const j = await pRes.json(); setPrompts(Array.isArray(j) ? j : j.prompts ?? []) }
      if (sovRes.ok) { const j = await sovRes.json(); setShareOfVoice(Array.isArray(j) ? j : j.entries ?? []) }
    } catch { /* silent */ } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const handleRunTests = async () => {
    setRunningTests(true)
    try { const r = await fetch("/api/seo/geo/run-tests", { method: "POST" }); if (r.ok) await fetchAll() }
    catch { /* silent */ } finally { setRunningTests(false) }
  }

  const filtered = verticalFilter ? prompts.filter((p) => p.vertical === verticalFilter) : prompts
  const trend = geoReport ? geoReport.citationsThisWeek - geoReport.citationsLastWeek : 0

  /* Loading skeleton */
  if (loading) return (
    <div>
      <style>{`@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}`}</style>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12, marginBottom: 20 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} style={{ ...glass, height: 90 }}>
            <div style={{ background: "linear-gradient(90deg,rgba(255,255,255,0.04) 25%,rgba(255,255,255,0.08) 50%,rgba(255,255,255,0.04) 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite", borderRadius: 6, width: "60%", height: 10, marginBottom: 12 }} />
            <div style={{ background: "linear-gradient(90deg,rgba(255,255,255,0.04) 25%,rgba(255,255,255,0.08) 50%,rgba(255,255,255,0.04) 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite", borderRadius: 6, width: "40%", height: 28 }} />
          </div>
        ))}
      </div>
      <div style={glass}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{ background: "linear-gradient(90deg,rgba(255,255,255,0.04) 25%,rgba(255,255,255,0.08) 50%,rgba(255,255,255,0.04) 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite", borderRadius: 6, height: 40, marginBottom: 6 }} />
        ))}
      </div>
    </div>
  )

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* ── Header Row ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <button onClick={handleRunTests} disabled={runningTests} style={{
          padding: "7px 16px", fontSize: 11, fontWeight: 600, fontFamily: dm,
          background: runningTests ? "rgba(192,139,136,0.3)" : ROSE_GOLD,
          color: runningTests ? TEXT_SECONDARY : "#1a1a1a", border: "none", borderRadius: 8,
          cursor: runningTests ? "default" : "pointer",
        }}>
          {runningTests ? "Running..." : "Run All Tests"}
        </button>
        <button onClick={() => setShowAddModal(true)} style={{
          padding: "7px 16px", fontSize: 11, fontWeight: 600, fontFamily: dm,
          background: "transparent", color: TEXT_SECONDARY,
          border: `1px solid ${CARD_BORDER}`, borderRadius: 8, cursor: "pointer",
        }}>
          + Add Prompt
        </button>
        <select value={verticalFilter} onChange={(e) => setVerticalFilter(e.target.value)} style={selectBase}>
          <option value="">All Verticals</option>
          {VERTICALS.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
        {runningTests && (
          <span style={{ fontSize: 11, color: AMBER, fontFamily: dm, display: "flex", alignItems: "center", gap: 6, marginLeft: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: AMBER, display: "inline-block", animation: "pulse 1.2s infinite" }} />
            Tests in progress...
          </span>
        )}
      </div>

      {/* ── KPI Cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
        <div style={glass}>
          <div style={lbl}>Citation Rate</div>
          <span style={{ ...bigNum, color: (geoReport?.citationRate ?? 0) >= 50 ? GREEN : (geoReport?.citationRate ?? 0) >= 25 ? AMBER : RED }}>
            {(geoReport?.citationRate ?? 0).toFixed(1)}%
          </span>
        </div>
        <div style={glass}>
          <div style={lbl}>Citations This Week</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={bigNum}>{geoReport?.citationsThisWeek ?? 0}</span>
            {trend !== 0 ? (
              <span style={{ fontSize: 11, fontFamily: dm, color: trend > 0 ? GREEN : RED }}>
                {trend > 0 ? "\u25B2" : "\u25BC"} {Math.abs(trend)}
              </span>
            ) : (
              <span style={{ fontSize: 11, color: TEXT_TERTIARY, fontFamily: dm }}>vs {geoReport?.citationsLastWeek ?? 0} last week</span>
            )}
          </div>
        </div>
        <div style={glass}>
          <div style={lbl}>Prompts Tested</div>
          <span style={{ ...bigNum, color: INDIGO }}>{geoReport?.promptsTested ?? 0}</span>
        </div>
        <div style={glass}>
          <div style={lbl}>Best Vertical</div>
          <div style={{ fontSize: 14, fontFamily: "'Bellfair', serif", color: GREEN }}>{geoReport?.bestVertical?.name ?? "--"}</div>
          {geoReport?.bestVertical && <div style={{ fontSize: 10, color: TEXT_TERTIARY, fontFamily: dm, marginTop: 2 }}>{geoReport.bestVertical.rate.toFixed(0)}% rate</div>}
        </div>
        <div style={glass}>
          <div style={lbl}>Worst Vertical</div>
          <div style={{ fontSize: 14, fontFamily: "'Bellfair', serif", color: RED }}>{geoReport?.worstVertical?.name ?? "--"}</div>
          {geoReport?.worstVertical && <div style={{ fontSize: 10, color: TEXT_TERTIARY, fontFamily: dm, marginTop: 2 }}>{geoReport.worstVertical.rate.toFixed(0)}% rate</div>}
        </div>
      </div>

      {/* ── Test Prompt Table ── */}
      <div style={{ ...glass, padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px 10px" }}>
          <span style={{ fontFamily: "'Bellfair', serif", fontSize: 18, color: TEXT_PRIMARY }}>Test Prompts</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: dm, fontSize: 12 }}>
            <thead>
              <tr>
                <th style={thStyle("left")}>Prompt</th>
                <th style={thStyle("left")}>Vertical</th>
                <th style={thStyle("left")}>Last Tested</th>
                {PLATFORMS.map((p) => <th key={p} style={thStyle("center")}>{p}</th>)}
                <th style={thStyle("left")}>Competitors</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={3 + PLATFORMS.length + 1} style={{ padding: 40, textAlign: "center", color: TEXT_TERTIARY, fontSize: 12, fontFamily: dm }}>
                    No test prompts yet. Click &quot;+ Add Prompt&quot; to get started.
                  </td>
                </tr>
              ) : filtered.map((p) => {
                const cnt = citedCount(p.results ?? [])
                const tint = rowTint(cnt, (p.results ?? []).length > 0)
                const comps = collectCompetitors(p.results ?? [])
                const expanded = expandedPromptId === p.id
                return (
                  <PromptRow key={p.id} prompt={p} count={cnt} tint={tint} competitors={comps}
                    isExpanded={expanded} onToggle={() => setExpandedPromptId(expanded ? null : p.id)} />
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── AI Share of Voice ── */}
      <div style={glass}>
        <span style={{ fontFamily: "'Bellfair', serif", fontSize: 18, color: TEXT_PRIMARY, display: "block", marginBottom: 16 }}>
          AI Share of Voice
        </span>
        {shareOfVoice.length === 0 ? (
          <div style={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center", color: TEXT_TERTIARY, fontSize: 12, fontFamily: dm }}>
            No data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(200, shareOfVoice.length * 40)}>
            <BarChart data={shareOfVoice} layout="vertical" margin={{ top: 0, right: 20, bottom: 0, left: 110 }}>
              <XAxis type="number" tick={{ fill: TEXT_TERTIARY, fontSize: 10 }} axisLine={{ stroke: CARD_BORDER }} tickLine={false} />
              <YAxis type="category" dataKey="company" tick={{ fill: TEXT_SECONDARY, fontSize: 11 }} axisLine={false} tickLine={false} width={105} />
              <Tooltip content={<SovTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
              <Bar dataKey="citations" radius={[0, 4, 4, 0]} barSize={20}>
                {shareOfVoice.map((e, i) => (
                  <Cell key={e.company} fill={e.company === "Oxen Finance" ? ROSE_GOLD : `rgba(255,255,255,${Math.max(0.08, 0.25 - i * 0.03)})`} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Add Prompt Modal ── */}
      {showAddModal && <AddPromptModal onClose={() => setShowAddModal(false)} onSaved={() => { setShowAddModal(false); fetchAll() }} />}
    </div>
  )
}

/* ── SOV Tooltip ── */
function SovTooltip({ active, payload }: { active?: boolean; payload?: { value: number; payload: ShareOfVoiceEntry }[] }) {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <div style={{ background: "var(--card-bg-solid)", border: `1px solid ${CARD_BORDER}`, borderRadius: 8, padding: "8px 14px", fontSize: 12, fontFamily: dm, color: TEXT_PRIMARY }}>
      <div style={{ fontWeight: 600, marginBottom: 2 }}>{d.payload.company}</div>
      <div style={{ color: TEXT_SECONDARY }}>{d.value} citation{d.value !== 1 ? "s" : ""}</div>
    </div>
  )
}

/* ── PromptRow ── */
function PromptRow({ prompt, count, tint, competitors, isExpanded, onToggle }: {
  prompt: GeoPrompt; count: number; tint: string; competitors: string[]
  isExpanded: boolean; onToggle: () => void
}) {
  const bdB = { borderBottom: `1px solid ${CARD_BORDER}` }
  return (
    <>
      <tr onClick={onToggle} style={{ cursor: "pointer", background: tint, transition: "background 0.12s" }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)" }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = tint }}>
        <td style={{ padding: "10px 12px", color: TEXT_PRIMARY, maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", ...bdB }}>
          {prompt.prompt}
        </td>
        <td style={{ padding: "10px 12px", ...bdB }}>
          <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 999, fontSize: 9, fontWeight: 600, fontFamily: dm,
            background: `${VERTICAL_COLORS[prompt.vertical] ?? TEXT_SECONDARY}18`,
            color: VERTICAL_COLORS[prompt.vertical] ?? TEXT_SECONDARY }}>
            {prompt.vertical}
          </span>
        </td>
        <td style={{ padding: "10px 12px", fontSize: 11, color: TEXT_TERTIARY, whiteSpace: "nowrap", ...bdB }}>
          {prompt.lastTested ? new Date(prompt.lastTested).toLocaleDateString() : "--"}
        </td>
        {PLATFORMS.map((plat) => {
          const r = (prompt.results ?? []).find((x) => x.platform === plat)
          return (
            <td key={plat} style={{ padding: "10px 12px", textAlign: "center", ...bdB }}>
              {r ? (r.oxenCited
                ? <span style={{ color: GREEN, fontSize: 14, fontWeight: 700 }}>{"\u2713"}</span>
                : <span style={{ color: RED, fontSize: 14, fontWeight: 700 }}>{"\u2717"}</span>
              ) : <span style={{ color: TEXT_TERTIARY, fontSize: 11 }}>--</span>}
            </td>
          )
        })}
        <td style={{ padding: "10px 12px", fontSize: 11, color: TEXT_SECONDARY, whiteSpace: "nowrap", ...bdB }}>
          {competitors.length > 0
            ? competitors.slice(0, 2).join(", ") + (competitors.length > 2 ? ` +${competitors.length - 2}` : "")
            : "--"}
        </td>
      </tr>

      {isExpanded && (
        <tr>
          <td colSpan={3 + PLATFORMS.length + 1} style={{ padding: "16px 20px", background: "rgba(255,255,255,0.015)", ...bdB }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <span style={lbl}>Full Prompt</span>
                <p style={{ color: TEXT_PRIMARY, fontSize: 12, margin: 0, lineHeight: 1.6, fontFamily: dm }}>{prompt.prompt}</p>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
                {(prompt.results ?? []).map((r) => (
                  <div key={r.platform} style={{ padding: 12, borderRadius: 8, background: "rgba(255,255,255,0.02)", border: `1px solid ${CARD_BORDER}` }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: TEXT_PRIMARY, fontFamily: dm }}>{r.platform}</span>
                      <span style={{ color: r.oxenCited ? GREEN : RED, fontSize: 10, fontWeight: 600, fontFamily: dm }}>{r.oxenCited ? "Cited" : "Not Cited"}</span>
                    </div>
                    {r.citationContext && (
                      <div style={{ marginBottom: 6 }}>
                        <span style={{ ...lbl, marginBottom: 3 }}>Citation Context</span>
                        <p style={{ color: TEXT_SECONDARY, fontSize: 11, margin: 0, lineHeight: 1.5 }}>{r.citationContext}</p>
                      </div>
                    )}
                    {r.responseExcerpt && (
                      <div style={{ marginBottom: 6 }}>
                        <span style={{ ...lbl, marginBottom: 3 }}>Response Excerpt</span>
                        <p style={{ color: TEXT_TERTIARY, fontSize: 11, margin: 0, lineHeight: 1.5, fontStyle: "italic" }}>&quot;{r.responseExcerpt}&quot;</p>
                      </div>
                    )}
                    {r.competitorsCited?.length > 0 && (
                      <div>
                        <span style={{ ...lbl, marginBottom: 3 }}>Competitors</span>
                        <p style={{ color: TEXT_TERTIARY, fontSize: 10, margin: 0, fontFamily: dm }}>{r.competitorsCited.join(", ")}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {competitors.length > 0 && (
                <div>
                  <span style={lbl}>All Competitors Cited</span>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {competitors.map((c) => (
                      <span key={c} style={{ padding: "3px 10px", borderRadius: 4, fontSize: 11, background: "rgba(255,255,255,0.05)", color: TEXT_SECONDARY, fontFamily: dm }}>{c}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

/* ── AddPromptModal ── */
function AddPromptModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [promptText, setPromptText] = useState("")
  const [vertical, setVertical] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const handleSave = async () => {
    if (!promptText.trim() || !vertical) { setError("Both prompt and vertical are required."); return }
    setSaving(true); setError("")
    try {
      const res = await fetch("/api/seo/geo/prompts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: promptText.trim(), vertical }),
      })
      if (!res.ok) throw new Error("Failed")
      onSaved()
    } catch { setError("Could not save prompt. Please try again.") } finally { setSaving(false) }
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 16, padding: 28,
        backdropFilter: "blur(20px)", boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
        width: "100%", maxWidth: 500, display: "flex", flexDirection: "column", gap: 16,
      }}>
        <span style={{ fontFamily: "'Bellfair', serif", fontSize: 20, color: TEXT_PRIMARY }}>Add Test Prompt</span>
        <div>
          <label style={lbl}>Prompt *</label>
          <textarea value={promptText} onChange={(e) => setPromptText(e.target.value)}
            placeholder="e.g. What are the best financial service providers for crypto companies?"
            rows={4} style={{ ...inputBase, resize: "vertical", minHeight: 80 }} />
        </div>
        <div>
          <label style={lbl}>Vertical *</label>
          <select value={vertical} onChange={(e) => setVertical(e.target.value)} style={{ ...selectBase, width: "100%" }}>
            <option value="">Select vertical...</option>
            {VERTICALS.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        {error && <span style={{ fontSize: 11, color: RED, fontFamily: dm }}>{error}</span>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 4 }}>
          <button onClick={onClose} style={{
            padding: "8px 18px", fontSize: 12, fontFamily: dm, background: "transparent",
            border: `1px solid ${CARD_BORDER}`, borderRadius: 8, color: TEXT_SECONDARY, cursor: "pointer",
          }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{
            padding: "8px 18px", fontSize: 12, fontWeight: 600, fontFamily: dm,
            background: ROSE_GOLD, color: "#1a1a1a", border: "none", borderRadius: 8,
            cursor: "pointer", opacity: saving ? 0.5 : 1,
          }}>{saving ? "Saving..." : "Save"}</button>
        </div>
      </div>
    </div>
  )
}
