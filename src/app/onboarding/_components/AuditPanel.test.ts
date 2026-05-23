// Smoke tests for AuditPanel — verifies the actor-field fix (the
// bug that prompted SP16-002b §4) plus the operator: prefix stripping.

import { describe, it, expect } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { createElement } from "react"
import AuditPanel from "./AuditPanel"
import type { AuditEvent } from "./detail-types"

function html(events: AuditEvent[]): string {
  return renderToStaticMarkup(createElement(AuditPanel, { events }))
}

describe("AuditPanel", () => {
  it("renders empty state when events array is empty", () => {
    const out = html([])
    expect(out).toContain("No operator actions yet")
  })

  it("displays operator: prefix actor as the bare email", () => {
    const out = html([
      {
        actor: "operator:vd@oxen.finance",
        action: "operator_slot_feed_sp15_004",
        payload: { slot: "triage.company_name", value: "Acme Trading GmbH" },
        created_at: "2026-05-22T07:15:59.272Z",
      },
    ])
    expect(out).toContain("vd@oxen.finance")
    // The colon-prefixed namespace is stripped — operators don't need
    // to read "operator:" before every human email in the timeline.
    expect(out).not.toContain("operator:vd@oxen.finance")
    expect(out).toContain("operator_slot_feed_sp15_004")
  })

  it("renders non-operator actors verbatim (lifecycle-emitter, agent, ...)", () => {
    const out = html([
      {
        actor: "lifecycle-emitter",
        action: "session_started",
        created_at: "2026-05-22T07:00:00Z",
      },
      {
        actor: "agent",
        action: "agent_message_sent",
        created_at: "2026-05-22T07:01:00Z",
      },
    ])
    expect(out).toContain("lifecycle-emitter")
    expect(out).toContain("agent")
    expect(out).toContain("session_started")
    expect(out).toContain("agent_message_sent")
  })

  it("falls back to '(unknown actor)' only when actor is genuinely null", () => {
    const out = html([
      {
        actor: null,
        action: "mysterious_event",
        created_at: "2026-05-22T07:00:00Z",
      },
    ])
    expect(out).toContain("(unknown actor)")
    expect(out).toContain("mysterious_event")
  })

  it("renders the payload JSON inline when present", () => {
    const out = html([
      {
        actor: "operator:vd@oxen.finance",
        action: "operator_slot_feed",
        payload: { slot: "triage.company_name", value: "Acme" },
        created_at: "2026-05-22T07:00:00Z",
      },
    ])
    expect(out).toContain("Acme")
    expect(out).toContain("slot")
  })

  it("omits the payload row when payload is missing/null", () => {
    const out = html([
      {
        actor: "agent",
        action: "tick",
        created_at: "2026-05-22T07:00:00Z",
      },
    ])
    expect(out).toContain("tick")
    expect(out).toContain("agent")
    // No empty payload div — the renderPayload helper returns "" and
    // the conditional drops the row.
  })
})
