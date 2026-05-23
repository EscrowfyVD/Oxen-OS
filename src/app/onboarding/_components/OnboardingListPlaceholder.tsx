"use client"

// Slice 1 placeholder — confirms the route is reachable when
// ONBOARDING_CONSOLE_ENABLED=true and the user passes the
// `onboarding` page-access rule. Replaced in Slice 3 by the real
// filterable session list view.

import { CRM_COLORS } from "@/lib/crm-config"

const TEXT = CRM_COLORS.text_primary
const TEXT2 = CRM_COLORS.text_secondary
const TEXT3 = CRM_COLORS.text_tertiary

export default function OnboardingListPlaceholder() {
  return (
    <div
      style={{
        padding: "24px 32px 80px",
        maxWidth: 1120,
        margin: "0 auto",
        color: TEXT,
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      <div style={{ marginBottom: 12 }}>
        <div
          style={{
            fontSize: 11,
            color: TEXT3,
            textTransform: "uppercase",
            letterSpacing: 1.2,
            marginBottom: 6,
          }}
        >
          Compliance · Onboarding
        </div>
        <h1
          style={{
            fontFamily: "'Bellfair', serif",
            fontSize: 28,
            fontWeight: 400,
            margin: 0,
            lineHeight: 1.2,
          }}
        >
          Onboarding
        </h1>
        <p
          style={{
            fontSize: 12,
            color: TEXT2,
            marginTop: 4,
            marginBottom: 0,
            lineHeight: 1.4,
          }}
        >
          KYB sessions feed from OCA (operator console).
        </p>
      </div>

      <div
        style={{
          marginTop: 32,
          padding: "60px 0",
          textAlign: "center",
          color: TEXT3,
          fontSize: 13,
          border: `1px dashed ${CRM_COLORS.card_border}`,
          borderRadius: 12,
        }}
      >
        <div style={{ fontSize: 14, color: TEXT, marginBottom: 8 }}>
          Session list — coming in Slice 3
        </div>
        <div>
          Scaffold confirmed. The full filterable table lands once the
          OCA proxy routes (Slice 2) ship.
        </div>
      </div>
    </div>
  )
}
