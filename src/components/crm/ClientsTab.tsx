"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import {
  CARD_BORDER, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_TERTIARY,
  FROST, ROSE_GOLD, GREEN, INDIGO,
  SECTOR_COLORS, STATUS_COLORS, HEALTH_COLORS, OUTREACH_STATUS_COLORS, AGENT_TYPE_COLORS,
  SECTORS, STATUSES, SEGMENTS, OUTREACH_STATUSES,
} from "./constants"
import type { Contact, Employee } from "./types"

interface ClientsTabProps {
  contacts: Contact[]
  employees: Employee[]
}

type SortKey = "name" | "company" | "sector" | "status" | "value" | "assignedTo" | "createdAt" | "healthStatus" | "monthlyGtv" | "monthlyRevenue" | "takeRate" | "segment" | "priorityScore" | "outreachStatus"

export default function ClientsTab({ contacts, employees }: ClientsTabProps) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [sectorFilter, setSectorFilter] = useState("all")
  const [assigneeFilter, setAssigneeFilter] = useState("all")
  const [healthFilter, setHealthFilter] = useState("all")
  const [segmentFilter, setSegmentFilter] = useState("all")
  const [agentFilter, setAgentFilter] = useState("all")
  const [outreachFilter, setOutreachFilter] = useState("all")
  const [sortBy, setSortBy] = useState<SortKey>("createdAt")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc")
    } else {
      setSortBy(key)
      setSortDir(key === "monthlyGtv" || key === "monthlyRevenue" || key === "value" || key === "priorityScore" ? "desc" : "asc")
    }
  }

  const filtered = useMemo(() => {
    let result = [...contacts]

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.company && c.company.toLowerCase().includes(q)) ||
          (c.email && c.email.toLowerCase().includes(q))
      )
    }
    if (statusFilter !== "all") result = result.filter((c) => c.status === statusFilter)
    if (sectorFilter !== "all") result = result.filter((c) => c.sector === sectorFilter)
    if (assigneeFilter !== "all") result = result.filter((c) => c.assignedTo === assigneeFilter)
    if (healthFilter !== "all") result = result.filter((c) => c.healthStatus === healthFilter)
    if (segmentFilter !== "all") result = result.filter((c) => c.segment === segmentFilter)
    if (agentFilter !== "all") {
      if (agentFilter === "none") {
        result = result.filter((c) => !c.agentId)
      } else {
        result = result.filter((c) => c.agentId === agentFilter)
      }
    }
    if (outreachFilter !== "all") result = result.filter((c) => c.outreachStatus === outreachFilter)

    result.sort((a, b) => {
      let aVal: string | number = ""
      let bVal: string | number = ""

      switch (sortBy) {
        case "name": aVal = a.name.toLowerCase(); bVal = b.name.toLowerCase(); break
        case "company": aVal = (a.company || "").toLowerCase(); bVal = (b.company || "").toLowerCase(); break
        case "sector": aVal = (a.sector || "").toLowerCase(); bVal = (b.sector || "").toLowerCase(); break
        case "status": aVal = a.status; bVal = b.status; break
        case "value": aVal = a.value ?? 0; bVal = b.value ?? 0; break
        case "assignedTo": aVal = (a.assignedTo || "").toLowerCase(); bVal = (b.assignedTo || "").toLowerCase(); break
        case "createdAt": aVal = a.createdAt; bVal = b.createdAt; break
        case "healthStatus": aVal = a.healthStatus; bVal = b.healthStatus; break
        case "monthlyGtv": aVal = a.monthlyGtv ?? 0; bVal = b.monthlyGtv ?? 0; break
        case "monthlyRevenue": aVal = a.monthlyRevenue ?? 0; bVal = b.monthlyRevenue ?? 0; break
        case "takeRate": aVal = a.takeRate ?? 0; bVal = b.takeRate ?? 0; break
        case "segment": aVal = (a.segment || "").toLowerCase(); bVal = (b.segment || "").toLowerCase(); break
        case "priorityScore": aVal = a.priorityScore ?? 0; bVal = b.priorityScore ?? 0; break
        case "outreachStatus": aVal = a.outreachStatus || ""; bVal = b.outreachStatus || ""; break
      }

      if (aVal < bVal) return sortDir === "asc" ? -1 : 1
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1
      return 0
    })

    return result
  }, [contacts, search, statusFilter, sectorFilter, assigneeFilter, healthFilter, segmentFilter, agentFilter, outreachFilter, sortBy, sortDir])

  const formatValue = (val: number | null, prefix = "€") => {
    if (val == null) return "—"
    if (val >= 1_000_000) return `${prefix}${(val / 1_000_000).toFixed(1)}M`
    if (val >= 1_000) return `${prefix}${(val / 1_000).toFixed(0)}K`
    return `${prefix}${val.toFixed(0)}`
  }

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "2-digit",
    })
  }

  const lastContact = (contact: Contact) => {
    if (!contact.interactions || contact.interactions.length === 0) return "—"
    const d = new Date(contact.interactions[0].createdAt)
    const now = new Date()
    const diff = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
    if (diff === 0) return "Today"
    if (diff === 1) return "Yesterday"
    return `${diff}d ago`
  }

  const sortIcon = (key: SortKey) => {
    if (sortBy !== key) return ""
    return sortDir === "asc" ? " ↑" : " ↓"
  }

  const uniqueAssignees = [...new Set(contacts.map((c) => c.assignedTo).filter(Boolean))] as string[]
  const uniqueAgents = useMemo(() => {
    const map = new Map<string, string>()
    contacts.forEach((c) => {
      if (c.agent && c.agentId) map.set(c.agentId, c.agent.name)
    })
    return Array.from(map.entries())
  }, [contacts])

  const thStyle: React.CSSProperties = {
    fontSize: 10,
    color: TEXT_TERTIARY,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontFamily: "'DM Sans', sans-serif",
    fontWeight: 500,
    padding: "10px 10px",
    textAlign: "left",
    cursor: "pointer",
    userSelect: "none",
    whiteSpace: "nowrap",
    borderBottom: `1px solid ${CARD_BORDER}`,
  }

  const tdStyle: React.CSSProperties = {
    fontSize: 12,
    color: TEXT_PRIMARY,
    fontFamily: "'DM Sans', sans-serif",
    padding: "10px 10px",
    borderBottom: `1px solid ${CARD_BORDER}`,
  }

  return (
    <div>
      {/* ── Filters row ── */}
      <div
        className="fade-in"
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 20,
          flexWrap: "wrap",
          alignItems: "center",
          animationDelay: "0.05s",
        }}
      >
        <input
          className="oxen-input"
          placeholder="Search name, company, email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 220 }}
        />

        <select
          className="oxen-input"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ width: 120, appearance: "none" }}
        >
          <option value="all">All Status</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>

        <select
          className="oxen-input"
          value={healthFilter}
          onChange={(e) => setHealthFilter(e.target.value)}
          style={{ width: 120, appearance: "none" }}
        >
          <option value="all">All Health</option>
          <option value="healthy">Healthy</option>
          <option value="watch">Watch</option>
          <option value="at_risk">At Risk</option>
          <option value="declining">Declining</option>
          <option value="churned">Churned</option>
        </select>

        <select
          className="oxen-input"
          value={segmentFilter}
          onChange={(e) => setSegmentFilter(e.target.value)}
          style={{ width: 120, appearance: "none" }}
        >
          <option value="all">All Segments</option>
          {SEGMENTS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <select
          className="oxen-input"
          value={sectorFilter}
          onChange={(e) => setSectorFilter(e.target.value)}
          style={{ width: 130, appearance: "none" }}
        >
          <option value="all">All Sectors</option>
          {SECTORS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <select
          className="oxen-input"
          value={assigneeFilter}
          onChange={(e) => setAssigneeFilter(e.target.value)}
          style={{ width: 130, appearance: "none" }}
        >
          <option value="all">All Assignees</option>
          {uniqueAssignees.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>

        <select
          className="oxen-input"
          value={agentFilter}
          onChange={(e) => setAgentFilter(e.target.value)}
          style={{ width: 130, appearance: "none" }}
        >
          <option value="all">All Agents</option>
          <option value="none">No Agent</option>
          {uniqueAgents.map(([id, name]) => (
            <option key={id} value={id}>{name}</option>
          ))}
        </select>

        <select
          className="oxen-input"
          value={outreachFilter}
          onChange={(e) => setOutreachFilter(e.target.value)}
          style={{ width: 130, appearance: "none" }}
        >
          <option value="all">All Outreach</option>
          {OUTREACH_STATUSES.map((s) => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>

        <span
          style={{
            fontSize: 11,
            color: TEXT_TERTIARY,
            fontFamily: "'DM Sans', sans-serif",
            marginLeft: "auto",
          }}
        >
          {filtered.length} contact{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* ── Table ── */}
      <div className="card fade-in" style={{ overflow: "hidden", animationDelay: "0.1s" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle} onClick={() => toggleSort("name")}>
                  Name{sortIcon("name")}
                </th>
                <th style={thStyle} onClick={() => toggleSort("company")}>
                  Company{sortIcon("company")}
                </th>
                <th style={thStyle} onClick={() => toggleSort("segment")}>
                  Segment{sortIcon("segment")}
                </th>
                <th style={thStyle} onClick={() => toggleSort("healthStatus")}>
                  Health{sortIcon("healthStatus")}
                </th>
                <th style={thStyle} onClick={() => toggleSort("sector")}>
                  Sector{sortIcon("sector")}
                </th>
                <th style={thStyle} onClick={() => toggleSort("status")}>
                  Status{sortIcon("status")}
                </th>
                <th style={{ ...thStyle, textAlign: "center" }} onClick={() => toggleSort("priorityScore")}>
                  Priority{sortIcon("priorityScore")}
                </th>
                <th style={thStyle}>
                  Agent
                </th>
                <th style={thStyle} onClick={() => toggleSort("outreachStatus")}>
                  Outreach{sortIcon("outreachStatus")}
                </th>
                <th style={{ ...thStyle, textAlign: "right" }} onClick={() => toggleSort("monthlyGtv")}>
                  Monthly GTV{sortIcon("monthlyGtv")}
                </th>
                <th style={{ ...thStyle, textAlign: "right" }} onClick={() => toggleSort("monthlyRevenue")}>
                  Revenue{sortIcon("monthlyRevenue")}
                </th>
                <th style={{ ...thStyle, textAlign: "right" }} onClick={() => toggleSort("takeRate")}>
                  Rate{sortIcon("takeRate")}
                </th>
                <th style={thStyle} onClick={() => toggleSort("assignedTo")}>
                  Assigned{sortIcon("assignedTo")}
                </th>
                <th style={thStyle}>Last Contact</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((contact) => {
                const statusColor = STATUS_COLORS[contact.status] || STATUS_COLORS.lead
                const sectorColor = contact.sector ? SECTOR_COLORS[contact.sector] || SECTOR_COLORS.Other : null
                const healthColor = HEALTH_COLORS[contact.healthStatus] || HEALTH_COLORS.healthy

                return (
                  <tr
                    key={contact.id}
                    onClick={() => router.push(`/crm/${contact.id}`)}
                    style={{ cursor: "pointer", transition: "background 0.15s" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.02)" }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent" }}
                  >
                    <td style={tdStyle}>
                      <span style={{ fontWeight: 500 }}>{contact.name}</span>
                    </td>
                    <td style={{ ...tdStyle, color: TEXT_SECONDARY }}>
                      {contact.company || "—"}
                    </td>
                    <td style={{ ...tdStyle, fontSize: 10, color: TEXT_SECONDARY }}>
                      {contact.segment || "—"}
                    </td>
                    <td style={tdStyle}>
                      <span
                        style={{
                          fontSize: 9,
                          textTransform: "uppercase",
                          letterSpacing: 0.5,
                          fontWeight: 500,
                          padding: "2px 6px",
                          borderRadius: 8,
                          background: healthColor.bg,
                          color: healthColor.text,
                        }}
                      >
                        {contact.healthStatus.replace("_", " ")}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      {sectorColor ? (
                        <span
                          style={{
                            fontSize: 9,
                            textTransform: "uppercase",
                            letterSpacing: 0.5,
                            fontWeight: 500,
                            padding: "2px 8px",
                            borderRadius: 10,
                            background: sectorColor.bg,
                            color: sectorColor.text,
                          }}
                        >
                          {contact.sector}
                        </span>
                      ) : (
                        <span style={{ color: TEXT_TERTIARY }}>—</span>
                      )}
                    </td>
                    <td style={tdStyle}>
                      <span
                        style={{
                          fontSize: 9,
                          textTransform: "uppercase",
                          letterSpacing: 0.5,
                          fontWeight: 500,
                          padding: "2px 8px",
                          borderRadius: 10,
                          background: statusColor.bg,
                          color: statusColor.text,
                        }}
                      >
                        {contact.status}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>
                      {contact.priorityScore != null && contact.priorityScore > 0 ? (
                        <span style={{
                          fontSize: 11, fontWeight: 600, fontFamily: "'DM Sans', sans-serif",
                          color: contact.priorityScore >= 70 ? ROSE_GOLD : contact.priorityScore >= 40 ? INDIGO : TEXT_SECONDARY,
                        }}>
                          {contact.priorityScore}
                        </span>
                      ) : (
                        <span style={{ color: TEXT_TERTIARY }}>{"\u2014"}</span>
                      )}
                    </td>
                    <td style={{ ...tdStyle, fontSize: 11, color: TEXT_SECONDARY }}>
                      {contact.agent ? contact.agent.name : "\u2014"}
                    </td>
                    <td style={tdStyle}>
                      {contact.outreachStatus ? (
                        <span style={{
                          fontSize: 9, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 500,
                          padding: "2px 6px", borderRadius: 8,
                          background: OUTREACH_STATUS_COLORS[contact.outreachStatus]?.bg || "rgba(255,255,255,0.06)",
                          color: OUTREACH_STATUS_COLORS[contact.outreachStatus]?.text || TEXT_SECONDARY,
                        }}>
                          {contact.outreachStatus}
                        </span>
                      ) : (
                        <span style={{ color: TEXT_TERTIARY }}>{"\u2014"}</span>
                      )}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right", fontFamily: "'Bellfair', serif", fontSize: 13 }}>
                      {formatValue(contact.monthlyGtv)}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right", fontFamily: "'Bellfair', serif", fontSize: 13 }}>
                      {formatValue(contact.monthlyRevenue)}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right", color: TEXT_SECONDARY, fontSize: 11 }}>
                      {contact.takeRate != null ? `${contact.takeRate}%` : "—"}
                    </td>
                    <td style={{ ...tdStyle, color: TEXT_SECONDARY }}>
                      {contact.assignedTo || "—"}
                    </td>
                    <td style={{ ...tdStyle, color: TEXT_TERTIARY, fontSize: 11 }}>
                      {lastContact(contact)}
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={14}
                    style={{
                      ...tdStyle,
                      textAlign: "center",
                      padding: "40px 12px",
                      color: TEXT_TERTIARY,
                    }}
                  >
                    {search || statusFilter !== "all" || sectorFilter !== "all" || healthFilter !== "all" || agentFilter !== "all" || outreachFilter !== "all"
                      ? "No contacts match your filters"
                      : "No contacts yet — click \"+ New Contact\" to add one"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
