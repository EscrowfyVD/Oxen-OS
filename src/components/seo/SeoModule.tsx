"use client"

import { useState } from "react"
import SeoOverview from "./SeoOverview"
import KeywordsTab from "./KeywordsTab"
import BlogWriterTab from "./BlogWriterTab"
import GeoMonitorTab from "./GeoMonitorTab"
import NewsMonitorTab from "./NewsMonitorTab"
import SeoReportsTab from "./SeoReportsTab"

type SeoSubTab = "overview" | "keywords" | "writer" | "geo" | "news" | "reports"

const SUB_TABS: { id: SeoSubTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "keywords", label: "Keywords" },
  { id: "writer", label: "Blog Writer" },
  { id: "geo", label: "GEO Monitoring" },
  { id: "news", label: "News Monitor" },
  { id: "reports", label: "Reports" },
]

const CARD_BORDER = "var(--card-border)"
const TEXT_PRIMARY = "var(--text-primary)"
const TEXT_TERTIARY = "var(--text-tertiary)"
const ROSE_GOLD = "#C08B88"

export default function SeoModule() {
  const [activeTab, setActiveTab] = useState<SeoSubTab>("overview")

  return (
    <div>
      {/* Sub-tab bar */}
      <div
        style={{
          display: "flex",
          gap: 0,
          borderBottom: `1px solid ${CARD_BORDER}`,
          marginBottom: 20,
        }}
      >
        {SUB_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: "8px 16px",
              fontSize: 11,
              fontWeight: 500,
              fontFamily: "'DM Sans', sans-serif",
              color: activeTab === tab.id ? TEXT_PRIMARY : TEXT_TERTIARY,
              background: "transparent",
              border: "none",
              borderBottom:
                activeTab === tab.id
                  ? `2px solid ${ROSE_GOLD}`
                  : "2px solid transparent",
              cursor: "pointer",
              transition: "all 0.15s",
              marginBottom: -1,
              letterSpacing: 0.3,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "overview" && <SeoOverview />}
      {activeTab === "keywords" && <KeywordsTab />}
      {activeTab === "writer" && <BlogWriterTab />}
      {activeTab === "geo" && <GeoMonitorTab />}
      {activeTab === "news" && <NewsMonitorTab />}
      {activeTab === "reports" && <SeoReportsTab />}
    </div>
  )
}
