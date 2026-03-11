"use client"

import PageHeader from "@/components/layout/PageHeader"

export default function CrmPage() {
  return (
    <div>
      <PageHeader
        title="CRM"
        description="Customer relationship management"
      />

      <div
        className="flex flex-col items-center justify-center py-24"
      >
        <div
          className="card flex flex-col items-center justify-center p-12 max-w-md w-full text-center"
          style={{ border: "1px solid var(--border)" }}
        >
          <div
            className="flex items-center justify-center rounded-2xl mb-6"
            style={{
              width: 80,
              height: 80,
              background: "var(--rose-dim)",
            }}
          >
            <span className="text-4xl">{"\uD83D\uDD04"}</span>
          </div>

          <h2
            className="text-xl font-bold mb-2"
            style={{
              color: "var(--text)",
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            Coming Soon
          </h2>

          <p
            className="text-sm mb-6"
            style={{ color: "var(--text-dim)", lineHeight: 1.6 }}
          >
            The CRM module is currently under development. Track clients,
            manage pipelines, and monitor deal flow all in one place.
          </p>

          <div
            className="flex items-center gap-6 text-center"
            style={{ color: "var(--text-dim)" }}
          >
            <div>
              <div
                className="flex items-center justify-center rounded-lg mb-2"
                style={{
                  width: 40,
                  height: 40,
                  background: "rgba(91,155,191,0.12)",
                  margin: "0 auto",
                }}
              >
                <span style={{ color: "var(--blue)", fontSize: 16 }}>
                  {"\uD83D\uDCCA"}
                </span>
              </div>
              <div className="text-[10px]">Pipelines</div>
            </div>
            <div>
              <div
                className="flex items-center justify-center rounded-lg mb-2"
                style={{
                  width: 40,
                  height: 40,
                  background: "rgba(92,184,104,0.12)",
                  margin: "0 auto",
                }}
              >
                <span style={{ color: "var(--green)", fontSize: 16 }}>
                  {"\uD83D\uDC64"}
                </span>
              </div>
              <div className="text-[10px]">Contacts</div>
            </div>
            <div>
              <div
                className="flex items-center justify-center rounded-lg mb-2"
                style={{
                  width: 40,
                  height: 40,
                  background: "rgba(229,196,83,0.12)",
                  margin: "0 auto",
                }}
              >
                <span style={{ color: "var(--yellow)", fontSize: 16 }}>
                  {"\uD83D\uDCB0"}
                </span>
              </div>
              <div className="text-[10px]">Deals</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
