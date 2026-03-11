"use client"

import PageHeader from "@/components/layout/PageHeader"

const features = [
  {
    icon: "\uD83D\uDCCA",
    label: "Pipelines",
    desc: "Track deal stages",
    color: "#5B9BBF",
  },
  {
    icon: "\uD83D\uDC64",
    label: "Contacts",
    desc: "Manage relationships",
    color: "#5CB868",
  },
  {
    icon: "\uD83D\uDCB0",
    label: "Deals",
    desc: "Monitor revenue",
    color: "#E5C453",
  },
  {
    icon: "\uD83D\uDCE7",
    label: "Outreach",
    desc: "Email campaigns",
    color: "#9B7FD4",
  },
]

export default function CrmPage() {
  return (
    <div className="page-content">
      <PageHeader
        title="CRM"
        description="Customer relationship management"
      />

      <div className="flex flex-col items-center justify-center" style={{ padding: "40px 0" }}>
        <div
          className="card"
          style={{
            overflow: "hidden",
            maxWidth: 480,
            width: "100%",
            textAlign: "center",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "32px 32px 24px",
              background: "linear-gradient(135deg, rgba(192,139,136,0.08), transparent)",
            }}
          >
            <div
              className="flex items-center justify-center"
              style={{
                width: 72,
                height: 72,
                borderRadius: 18,
                background: "var(--rose-dim)",
                margin: "0 auto 20px",
              }}
            >
              <span style={{ fontSize: 32 }}>{"\uD83D\uDD04"}</span>
            </div>

            <h2
              style={{
                fontSize: 22,
                fontWeight: 400,
                fontFamily: "'Bellfair', serif",
                color: "var(--text)",
                marginBottom: 8,
              }}
            >
              Coming Soon
            </h2>

            <p
              style={{
                fontSize: 13,
                color: "var(--text-dim)",
                lineHeight: 1.6,
                maxWidth: 320,
                margin: "0 auto",
              }}
            >
              The CRM module is under development. Track clients,
              manage pipelines, and monitor deal flow all in one place.
            </p>
          </div>

          {/* Feature grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 1,
              background: "var(--border)",
              borderTop: "1px solid var(--border)",
            }}
          >
            {features.map((f) => (
              <div
                key={f.label}
                style={{
                  padding: "20px 16px",
                  background: "var(--bg-card)",
                  textAlign: "center",
                }}
              >
                <div
                  className="flex items-center justify-center"
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: `${f.color}18`,
                    margin: "0 auto 10px",
                    fontSize: 18,
                  }}
                >
                  {f.icon}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--text)",
                    fontFamily: "'DM Sans', sans-serif",
                    marginBottom: 2,
                  }}
                >
                  {f.label}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: "var(--text-dim)",
                  }}
                >
                  {f.desc}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
