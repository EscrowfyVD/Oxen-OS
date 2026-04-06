"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Plus, RefreshCw, Star, ExternalLink, CheckCircle, XCircle,
  Linkedin, Github, Globe, Newspaper, FileText, AlertTriangle,
  ChevronRight, Calendar, Users, X, Loader2, Eye, EyeOff,
  Megaphone, Sparkles, TrendingUp, Trash2, Archive, Download,
  Send, Filter, SortAsc, MoreHorizontal, Check,
} from "lucide-react"

/* ── Design tokens ── */
const VOID = "#060709"
const CARD_BG = "rgba(255,255,255,0.03)"
const CARD_BORDER = "rgba(255,255,255,0.06)"
const TEXT_PRIMARY = "rgba(240,240,242,0.92)"
const TEXT_SECONDARY = "rgba(240,240,242,0.55)"
const TEXT_TERTIARY = "rgba(240,240,242,0.3)"
const ROSE_GOLD = "#C08B88"

const CATEGORY_COLORS: Record<string, string> = {
  marketing: "#C08B88",
  ai_tools: "#818CF8",
  competitors: "#EF4444",
  regulations: "#F59E0B",
  conferences: "#22C55E",
  oxen: "#5BB8A8",
  finance: "#A855F7",
}

const CATEGORY_ICONS: Record<string, string> = {
  marketing: "🎯",
  ai_tools: "🤖",
  competitors: "⚔️",
  regulations: "📜",
  conferences: "🎪",
  oxen: "🏛",
  finance: "💰",
}

const CATEGORY_LABELS: Record<string, string> = {
  all: "All",
  marketing: "Marketing",
  ai_tools: "AI Tools",
  competitors: "Competitors",
  regulations: "Regulations",
  conferences: "Conferences",
  oxen: "Oxen",
  finance: "Finance",
}

const SUBCATEGORIES: Record<string, { value: string; label: string }[]> = {
  marketing: [
    { value: "social_trends", label: "Social Media Trends" },
    { value: "competitive_intel", label: "Marketing Competitive Intel" },
    { value: "repost_suggestions", label: "Repost Suggestions" },
    { value: "content_ideas", label: "Content Ideas" },
  ],
  ai_tools: [
    { value: "trending_tools", label: "Trending AI Tools" },
    { value: "github_repos", label: "GitHub Repositories" },
    { value: "google_search", label: "Google Search" },
    { value: "news_scraping", label: "AI News Monitoring" },
  ],
  competitors: [
    { value: "business_news", label: "Business News" },
    { value: "website_changes", label: "Website Changes" },
    { value: "reviews", label: "Reviews Monitoring" },
  ],
  regulations: [
    { value: "new_regulation", label: "New Regulations" },
    { value: "regulation_change", label: "Regulation Changes" },
    { value: "regulation_removal", label: "Regulation Removals" },
    { value: "regulation_news", label: "Regulatory News" },
  ],
  conferences: [
    { value: "relevant_conferences", label: "Relevant Conferences" },
  ],
  oxen: [
    { value: "news_mentions", label: "News Mentions" },
    { value: "social_mentions", label: "Social Mentions" },
    { value: "reviews_oxen", label: "Reviews" },
  ],
  finance: [
    { value: "financial_news", label: "Financial News" },
    { value: "fundraisings", label: "Fundraising Rounds" },
  ],
}

const PREFILLED_QUERIES: Record<string, string> = {
  social_trends: "Analyze the latest social media trends in fintech, payments, and digital banking across LinkedIn and Twitter. What topics get the most engagement? What formats work best (carousel, video, text, polls)? What hashtags are trending? Focus on B2B financial services content.",
  competitive_intel: "Analyze how our competitors (Mercury, Wise Business, Payoneer, Revolut Business, Relay) market themselves on social media. For each: posting frequency per week, most common topics, best performing posts (highest engagement), posting times, tone of voice, visual style. Provide actionable insights for Oxen to differentiate.",
  repost_suggestions: "Find 5-10 recent LinkedIn posts from fintech thought leaders, banking innovation pages, or payment industry experts that would be relevant for Oxen Finance to repost or comment on. Posts should align with: multi-currency banking, crypto-friendly payments, iGaming financial services, or compliance innovation.",
  content_ideas: "Generate 10 content ideas for Oxen Finance's social media (LinkedIn primarily). Topics should cover: crypto-to-fiat solutions, iGaming banking challenges, multi-jurisdictional compliance, Dubai fintech ecosystem, family office banking. Mix formats: thought leadership posts, client success angles, industry data, controversial takes.",
  trending_tools: "Find the 10 most trending AI tools this week across Twitter, Reddit, and ProductHunt that are relevant for: sales automation, compliance automation, fintech operations, customer support, document processing, or internal tooling. For each: name, what it does, pricing, why it matters for a fintech company.",
  github_repos: "Find the 10 most starred GitHub repositories from the past month related to: LLM applications, AI agents, fintech tooling, payment processing, compliance automation, or sales intelligence. For each: repo name, stars, description, language, and how Oxen could use it.",
  google_search: "Search for the latest AI tools and fintech innovations trending on Google. Focus on tools useful for banking operations, compliance, sales intelligence, and payment processing.",
  news_scraping: "Find the latest AI news from the past week relevant to fintech and banking: new model releases, AI regulation affecting financial services, AI tools for compliance, new AI startups in finance, and breakthroughs in document processing or fraud detection.",
  business_news: "Find recent news about Mercury, Wise Business, Payoneer, Revolut Business, and Relay Financial. Focus ONLY on: new licenses obtained, new features launched, regulatory fines or issues, layoffs or mass hiring, new countries or markets entered, partnerships announced. Exclude marketing content.",
  website_changes: "Check for recent changes on competitor websites (Mercury.com, Wise.com/business, Payoneer.com, Revolut.com/business). Look for: new product pages, pricing changes, new features listed, terms and conditions updates, new landing pages, design overhauls.",
  reviews: "Analyze recent reviews of Mercury, Wise Business, Payoneer, and Revolut Business on Trustpilot, G2, and Reddit. Identify: common complaints, praise, feature requests, service quality trends. Flag any sudden waves of negative reviews that might indicate problems we can capitalize on.",
  new_regulation: "Find new financial regulations enacted in the past 3 months across: EU (MiCA, PSD3, DORA), UK (FCA), UAE (CBUAE, VARA), Malta (MFSA), Switzerland (FINMA), Luxembourg (CSSF). Focus on regulations affecting: payment services, crypto/VASP, banking licenses, AML/KYC requirements.",
  regulation_change: "Find any amendments or changes to existing financial regulations that affect payment service providers, VASPs, or banking in: EU, UK, UAE, Malta, Switzerland, Luxembourg. Include effective dates and key impacts.",
  regulation_removal: "Find any financial regulations being relaxed, removed, or simplified in the EU, UK, Malta, Cyprus, UAE that could benefit payment/banking companies like Oxen. Include potential opportunities.",
  regulation_news: "Research news and commentary about upcoming regulatory changes in financial services, payments, and crypto that could affect Oxen Finance. Include expert opinions and timeline predictions.",
  relevant_conferences: "Find upcoming fintech, payments, iGaming, crypto, and banking conferences in the next 6 months. For each provide: name, location, exact dates, main topics, estimated ticket price, key speakers, and a specific reason why Oxen Finance should attend. Focus on: Europe, UAE, Malta, Cyprus, UK. Include SiGMA, Money20/20, Paris Fintech Forum, and similar tier events.",
  news_mentions: "Search for any news articles, blog posts, or press mentions of Oxen Finance, Escrowfy, Lapki Digital Pay, or Galaktika Pay across news sites, fintech blogs, and industry publications.",
  social_mentions: "Search for any social media posts mentioning Oxen Finance, Escrowfy, or related brands on LinkedIn, Twitter/X, and Reddit. Include direct mentions, tags, and contextual references.",
  reviews_oxen: "Find any reviews or mentions of Oxen Finance, Escrowfy on Trustpilot, G2, Reddit, or other review platforms. Categorize as positive, negative, or neutral with key quotes.",
  financial_news: "Find the most important financial news from the past week affecting: fintech, digital banking, crypto markets, payment processing, and cross-border transactions. Focus on news that directly impacts Oxen's business model or client sectors (iGaming, crypto, family offices, luxury).",
  fundraisings: "Find recent fundraising rounds (past 30 days) in fintech, payments, crypto, and digital banking. For each: company name, round size, stage (seed/A/B/C), investors, what they do, and relevance to Oxen's market.",
}

const SOURCE_ICONS: Record<string, React.ReactNode> = {
  linkedin: <Linkedin size={14} />,
  twitter: <span style={{ fontSize: 13, fontWeight: 700 }}>𝕏</span>,
  reddit: <span style={{ fontSize: 14 }}>🔴</span>,
  github: <Github size={14} />,
  google: <Globe size={14} />,
  news: <Newspaper size={14} />,
  website: <Globe size={14} />,
  review_site: <Star size={14} />,
  regulatory: <FileText size={14} />,
  conference_site: <Calendar size={14} />,
}

const ALL_SOURCES = [
  { value: "linkedin", label: "LinkedIn" },
  { value: "twitter", label: "Twitter / X" },
  { value: "reddit", label: "Reddit" },
  { value: "github", label: "GitHub" },
  { value: "google", label: "Google Search" },
  { value: "news", label: "News Sites" },
  { value: "review_site", label: "Review Sites (Trustpilot, G2)" },
  { value: "regulatory", label: "Regulatory Registers" },
  { value: "conference_site", label: "Conference Sites" },
  { value: "website", label: "Company Websites" },
]

const SOURCE_PRESETS: Record<string, string[]> = {
  social_trends: ["linkedin", "twitter", "reddit"],
  competitive_intel: ["linkedin", "twitter", "website"],
  repost_suggestions: ["linkedin", "twitter"],
  content_ideas: ["linkedin", "twitter", "reddit", "news"],
  trending_tools: ["twitter", "reddit", "github", "google", "news"],
  github_repos: ["github"],
  google_search: ["google", "news"],
  news_scraping: ["news", "google"],
  business_news: ["news", "google", "linkedin"],
  website_changes: ["website"],
  reviews: ["review_site"],
  new_regulation: ["regulatory", "news", "google"],
  regulation_change: ["regulatory", "news", "google"],
  regulation_removal: ["regulatory", "news"],
  regulation_news: ["news", "google", "regulatory"],
  relevant_conferences: ["conference_site", "google"],
  news_mentions: ["news", "google"],
  social_mentions: ["linkedin", "twitter", "reddit"],
  reviews_oxen: ["review_site"],
  financial_news: ["news", "google"],
  fundraisings: ["news", "google", "linkedin"],
}

const ALL_REGIONS = [
  { value: "europe", label: "Europe" },
  { value: "uae", label: "UAE" },
  { value: "uk", label: "UK" },
  { value: "malta", label: "Malta" },
  { value: "cyprus", label: "Cyprus" },
  { value: "luxembourg", label: "Luxembourg" },
  { value: "usa", label: "USA" },
  { value: "asia", label: "Asia" },
  { value: "global", label: "Global" },
]

const SENTIMENT_COLORS: Record<string, { bg: string; text: string }> = {
  positive: { bg: "rgba(34,197,94,0.12)", text: "#22C55E" },
  negative: { bg: "rgba(239,68,68,0.12)", text: "#EF4444" },
  neutral: { bg: "rgba(255,255,255,0.06)", text: TEXT_TERTIARY },
}

const RELEVANCE_COLORS: Record<string, { bg: string; text: string }> = {
  critical: { bg: "rgba(239,68,68,0.2)", text: "#EF4444" },
  high: { bg: "rgba(239,68,68,0.12)", text: "#F87171" },
  medium: { bg: "rgba(245,158,11,0.12)", text: "#F59E0B" },
  low: { bg: "rgba(255,255,255,0.06)", text: TEXT_TERTIARY },
}

const FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "actionable", label: "Actionable" },
  { value: "starred", label: "Starred" },
  { value: "unread", label: "Unread" },
]

const SORT_OPTIONS = [
  { value: "relevance", label: "Relevance" },
  { value: "newest", label: "Newest" },
  { value: "sentiment", label: "Sentiment" },
]

type Research = {
  id: string
  title: string
  category: string
  subcategory: string | null
  query: string | null
  type: string
  frequency: string | null
  scheduledDay: string | null
  scheduledTime: string | null
  lastRunAt: string | null
  nextRunAt: string | null
  status: string
  archived: boolean
  createdBy: string
  createdAt: string
  resultCount: number
  unreadCount: number
}

type Result = {
  id: string
  researchId: string
  title: string
  summary: string
  source: string | null
  sourceType: string | null
  sentiment: string | null
  relevance: string
  actionable: boolean
  read: boolean
  starred: boolean
  dismissed: boolean
  metadata: Record<string, unknown> | null
  createdAt: string
  research: { title: string; category: string; subcategory: string | null }
}

export default function IntelPage() {
  const [category, setCategory] = useState("all")
  const [researches, setResearches] = useState<Research[]>([])
  const [results, setResults] = useState<Result[]>([])
  const [selectedResearch, setSelectedResearch] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [runningId, setRunningId] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [expandedResult, setExpandedResult] = useState<string | null>(null)
  const [showConferenceModal, setShowConferenceModal] = useState<string | null>(null)
  const [conferenceAttendees, setConferenceAttendees] = useState("")
  const [employees, setEmployees] = useState<{ id: string; name: string; email: string }[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [runningCron, setRunningCron] = useState(false)
  const [currentUserEmail, setCurrentUserEmail] = useState("")
  const [currentUserName, setCurrentUserName] = useState("")
  const [viewMode, setViewMode] = useState<"all" | "mine">("mine")

  // New improvement states
  const [showArchived, setShowArchived] = useState(false)
  const [bulkSelect, setBulkSelect] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null) // "completed" | researchId | null
  const [resultFilter, setResultFilter] = useState("all")
  const [resultSort, setResultSort] = useState("relevance")
  const [hoveredResult, setHoveredResult] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null)

  // New research form state
  const [formTitle, setFormTitle] = useState("")
  const [formCategory, setFormCategory] = useState("marketing")
  const [formSubcategory, setFormSubcategory] = useState("")
  const [formQuery, setFormQuery] = useState("")
  const [formType, setFormType] = useState("one_time")
  const [formFrequency, setFormFrequency] = useState("weekly")
  const [formSources, setFormSources] = useState<string[]>([])
  const [formKeywords, setFormKeywords] = useState<string[]>([])
  const [formKeywordInput, setFormKeywordInput] = useState("")
  const [formCompanies, setFormCompanies] = useState<string[]>([])
  const [formCompanyInput, setFormCompanyInput] = useState("")
  const [formRegions, setFormRegions] = useState<string[]>(["europe", "uae", "uk", "malta", "cyprus"])
  const [formLanguage, setFormLanguage] = useState("english")
  const [formScheduledDay, setFormScheduledDay] = useState<string | null>(null)
  const [formScheduledTime, setFormScheduledTime] = useState("09:00")
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => {
        const rl = d.employee?.roleLevel ?? "member"
        const admin = rl === "super_admin" || rl === "admin"
        if (admin) {
          setIsAdmin(true)
          setViewMode("all")
        }
        if (d.employee?.email) setCurrentUserEmail(d.employee.email)
        if (d.employee?.name) setCurrentUserName(d.employee.name)
      })
      .catch(() => {})
    fetch("/api/team")
      .then((r) => r.json())
      .then((d) => setEmployees((d.employees || []).map((e: Record<string, string>) => ({ id: e.id, name: e.name, email: e.email }))))
      .catch(() => {})
  }, [])

  // Close context menu on click outside
  useEffect(() => {
    const handler = () => setContextMenu(null)
    if (contextMenu) window.addEventListener("click", handler)
    return () => window.removeEventListener("click", handler)
  }, [contextMenu])

  const fetchResearches = useCallback(() => {
    const params = new URLSearchParams()
    if (category !== "all") params.set("category", category)
    if (showArchived) params.set("showArchived", "true")
    const qs = params.toString() ? `?${params.toString()}` : ""
    fetch(`/api/intel/researches${qs}`)
      .then((r) => r.json())
      .then((d) => setResearches(d.researches || []))
      .catch(() => {})
  }, [category, showArchived])

  const fetchResults = useCallback(() => {
    setLoading(true)
    let url: string
    if (selectedResearch) {
      url = `/api/intel/results?researchId=${selectedResearch}&limit=50`
    } else {
      const params = new URLSearchParams()
      if (category !== "all") params.set("category", category)
      if (resultFilter !== "all") params.set("filter", resultFilter)
      params.set("sort", resultSort)
      params.set("limit", "50")
      url = `/api/intel/results/feed?${params.toString()}`
    }
    fetch(url)
      .then((r) => r.json())
      .then((d) => setResults(d.results || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [category, selectedResearch, resultFilter, resultSort])

  useEffect(() => { fetchResearches() }, [fetchResearches])
  useEffect(() => { fetchResults() }, [fetchResults])

  const runResearch = async (id: string) => {
    setRunningId(id)
    try {
      await fetch(`/api/intel/run/${id}`, { method: "POST" })
      fetchResearches()
      fetchResults()
    } catch { /* empty */ }
    setRunningId(null)
  }

  const runAllDue = async () => {
    setRunningCron(true)
    try {
      await fetch("/api/intel/cron", { method: "POST" })
      fetchResearches()
      fetchResults()
    } catch { /* empty */ }
    setRunningCron(false)
  }

  const toggleStar = async (id: string, current: boolean) => {
    await fetch(`/api/intel/results/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ starred: !current }),
    })
    setResults((prev) => prev.map((r) => (r.id === id ? { ...r, starred: !current } : r)))
  }

  const markRead = async (id: string) => {
    await fetch(`/api/intel/results/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read: true }),
    })
    setResults((prev) => prev.map((r) => (r.id === id ? { ...r, read: true } : r)))
  }

  const dismissResult = async (id: string) => {
    await fetch(`/api/intel/results/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dismissed: true }),
    })
    setResults((prev) => prev.filter((r) => r.id !== id))
  }

  const createResearch = async () => {
    if (!formTitle.trim()) return
    setCreating(true)
    try {
      const res = await fetch("/api/intel/researches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formTitle,
          category: formCategory,
          subcategory: formSubcategory || null,
          query: formQuery || null,
          sources: formSources,
          keywords: formKeywords,
          companies: formCompanies,
          regions: formRegions,
          language: formLanguage,
          type: formType,
          frequency: formType === "recurring" ? formFrequency : null,
          scheduledDay: formType === "recurring" ? formScheduledDay : null,
          scheduledTime: formType === "recurring" ? formScheduledTime : null,
        }),
      })
      const data = await res.json()

      if (res.status === 409) {
        // Duplicate detected
        alert(data.message || "Duplicate research detected")
        setCreating(false)
        return
      }

      setShowModal(false)
      setFormTitle("")
      setFormQuery("")
      setFormSubcategory("")
      setFormSources([])
      setFormKeywords([])
      setFormKeywordInput("")
      setFormCompanies([])
      setFormCompanyInput("")
      setFormRegions(["europe", "uae", "uk", "malta", "cyprus"])
      setFormLanguage("english")
      setFormScheduledDay(null)
      setFormScheduledTime("09:00")
      fetchResearches()

      // Auto-run the research
      if (data.research?.id) {
        runResearch(data.research.id)
      }
    } catch { /* empty */ }
    setCreating(false)
  }

  const deleteResearch = async (id: string) => {
    await fetch(`/api/intel/researches/${id}`, { method: "DELETE" })
    if (selectedResearch === id) setSelectedResearch(null)
    fetchResearches()
    fetchResults()
  }

  const archiveResearch = async (id: string) => {
    await fetch("/api/intel/researches", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "archive", ids: [id] }),
    })
    if (selectedResearch === id) setSelectedResearch(null)
    fetchResearches()
  }

  const deleteAllCompleted = async () => {
    await fetch("/api/intel/researches", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete_completed" }),
    })
    setShowDeleteConfirm(null)
    fetchResearches()
    fetchResults()
  }

  const bulkDeleteSelected = async () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    await fetch("/api/intel/researches", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "bulk_delete", ids }),
    })
    setSelectedIds(new Set())
    setBulkSelect(false)
    if (selectedResearch && ids.includes(selectedResearch)) setSelectedResearch(null)
    fetchResearches()
    fetchResults()
  }

  const bulkArchiveSelected = async () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    await fetch("/api/intel/researches", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "archive", ids }),
    })
    setSelectedIds(new Set())
    setBulkSelect(false)
    fetchResearches()
  }

  const pauseResearch = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "paused" ? "active" : "paused"
    await fetch(`/api/intel/researches/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    })
    fetchResearches()
  }

  const acceptConference = async (resultId: string) => {
    const attendeeList = conferenceAttendees.split(",").map((s) => s.trim()).filter(Boolean)
    await fetch(`/api/intel/conferences/${resultId}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attendees: attendeeList }),
    })
    setShowConferenceModal(null)
    setConferenceAttendees("")
    fetchResults()
  }

  const rejectConference = async (resultId: string) => {
    await fetch(`/api/intel/conferences/${resultId}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
    fetchResults()
  }

  const exportResults = (format: "csv" | "pdf") => {
    if (format === "csv") {
      const header = "Title,Category,Relevance,Sentiment,Actionable,Source,Date,Summary\n"
      const rows = results.map((r) =>
        `"${r.title.replace(/"/g, '""')}","${r.research.category}","${r.relevance}","${r.sentiment || ""}","${r.actionable}","${r.source || ""}","${new Date(r.createdAt).toLocaleDateString()}","${r.summary.replace(/"/g, '""').slice(0, 200)}"`
      ).join("\n")
      const blob = new Blob([header + rows], { type: "text/csv" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `intel-results-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  const formatDate = (d: string | null) => {
    if (!d) return "—"
    return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
  }

  const formatDateShort = (d: string | null) => {
    if (!d) return ""
    return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
  }

  // Group results by date
  const groupResultsByDate = (results: Result[]) => {
    const groups: { date: string; results: Result[] }[] = []
    let currentDate = ""
    for (const r of results) {
      const d = new Date(r.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
      if (d !== currentDate) {
        currentDate = d
        groups.push({ date: d, results: [r] })
      } else {
        groups[groups.length - 1].results.push(r)
      }
    }
    return groups
  }

  const toggleBulkId = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const categories = ["all", "marketing", "ai_tools", "competitors", "regulations", "conferences", "oxen", "finance"]

  // Filter researches based on viewMode
  const filteredResearches = viewMode === "mine"
    ? researches.filter((r) => {
        const cb = (r.createdBy || "").toLowerCase()
        return cb === currentUserEmail.toLowerCase() || cb === currentUserName.toLowerCase()
      })
    : researches

  const resultGroups = groupResultsByDate(results)

  return (
    <div style={{ padding: "32px 40px", minHeight: "100vh", background: VOID }}>
      {/* Header */}
      <div className="flex items-center justify-between" style={{ marginBottom: 28 }}>
        <div>
          <h1 style={{ fontFamily: "'Bellfair', serif", fontSize: 32, color: TEXT_PRIMARY, margin: 0 }}>Intel</h1>
          <p style={{ fontSize: 13, color: TEXT_TERTIARY, margin: "4px 0 0" }}>Strategic Intelligence Hub</p>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <button
              onClick={runAllDue}
              disabled={runningCron}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                borderRadius: 8,
                border: `1px solid ${CARD_BORDER}`,
                background: CARD_BG,
                color: TEXT_SECONDARY,
                fontSize: 12,
                cursor: "pointer",
                opacity: runningCron ? 0.5 : 1,
              }}
            >
              <RefreshCw size={13} className={runningCron ? "animate-spin" : ""} />
              Run All Due
            </button>
          )}
          <button
            onClick={() => setShowModal(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 16px",
              borderRadius: 8,
              border: "none",
              background: `linear-gradient(135deg, ${ROSE_GOLD}, #D4A5A2)`,
              color: VOID,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <Plus size={14} />
            New Research
          </button>
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex items-center gap-2" style={{ marginBottom: 24, overflowX: "auto" }}>
        {categories.map((cat) => {
          const active = category === cat
          const color = CATEGORY_COLORS[cat] || TEXT_SECONDARY
          return (
            <button
              key={cat}
              onClick={() => { setCategory(cat); setSelectedResearch(null) }}
              style={{
                padding: "6px 14px",
                borderRadius: 20,
                border: active ? `1px solid ${color}` : `1px solid ${CARD_BORDER}`,
                background: active ? `${color}15` : "transparent",
                color: active ? color : TEXT_SECONDARY,
                fontSize: 12,
                fontWeight: 500,
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "all 0.2s",
              }}
            >
              {cat !== "all" && <span style={{ marginRight: 4 }}>{CATEGORY_ICONS[cat]}</span>}
              {CATEGORY_LABELS[cat]}
            </button>
          )
        })}
      </div>

      {/* Main layout */}
      <div className="flex gap-6" style={{ minHeight: "calc(100vh - 200px)" }}>
        {/* Left panel — research list */}
        <div style={{ width: 300, flexShrink: 0 }}>
          {/* Left panel header */}
          <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: TEXT_TERTIARY, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Researches
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setBulkSelect(!bulkSelect)}
                style={{
                  fontSize: 10,
                  padding: "2px 8px",
                  borderRadius: 4,
                  border: `1px solid ${bulkSelect ? ROSE_GOLD : CARD_BORDER}`,
                  background: bulkSelect ? `${ROSE_GOLD}15` : "transparent",
                  color: bulkSelect ? ROSE_GOLD : TEXT_TERTIARY,
                  cursor: "pointer",
                }}
              >
                {bulkSelect ? "Cancel" : "Select"}
              </button>
              <button
                onClick={() => setShowArchived(!showArchived)}
                style={{
                  fontSize: 10,
                  padding: "2px 8px",
                  borderRadius: 4,
                  border: `1px solid ${showArchived ? "#818CF8" : CARD_BORDER}`,
                  background: showArchived ? "rgba(129,140,248,0.1)" : "transparent",
                  color: showArchived ? "#818CF8" : TEXT_TERTIARY,
                  cursor: "pointer",
                }}
              >
                <Archive size={10} style={{ display: "inline", verticalAlign: "middle", marginRight: 3 }} />
                {showArchived ? "Hide archived" : "Archived"}
              </button>
            </div>
          </div>

          {/* All / My Researches toggle */}
          <div className="flex" style={{ marginBottom: 10, borderRadius: 6, overflow: "hidden", border: `1px solid ${CARD_BORDER}` }}>
            {(["all", "mine"] as const).map((mode) => {
              const active = viewMode === mode
              return (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  style={{
                    flex: 1,
                    padding: "5px 0",
                    fontSize: 11,
                    fontWeight: 500,
                    cursor: "pointer",
                    border: "none",
                    background: active ? `${ROSE_GOLD}15` : "transparent",
                    color: active ? ROSE_GOLD : TEXT_TERTIARY,
                    borderBottom: active ? `2px solid ${ROSE_GOLD}` : "2px solid transparent",
                    transition: "all 0.15s",
                  }}
                >
                  {mode === "all" ? "All Researches" : "My Researches"}
                </button>
              )
            })}
          </div>

          {/* Bulk actions bar */}
          {bulkSelect && selectedIds.size > 0 && (
            <div className="flex items-center gap-2" style={{ marginBottom: 8, padding: "6px 10px", borderRadius: 6, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
              <span style={{ fontSize: 11, color: "#F87171" }}>{selectedIds.size} selected</span>
              <button onClick={bulkDeleteSelected} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, border: "none", background: "rgba(239,68,68,0.15)", color: "#EF4444", cursor: "pointer" }}>
                <Trash2 size={10} style={{ display: "inline", verticalAlign: "middle", marginRight: 2 }} />Delete
              </button>
              <button onClick={bulkArchiveSelected} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, border: "none", background: "rgba(129,140,248,0.15)", color: "#818CF8", cursor: "pointer" }}>
                <Archive size={10} style={{ display: "inline", verticalAlign: "middle", marginRight: 2 }} />Archive
              </button>
            </div>
          )}

          {/* Delete completed button */}
          {filteredResearches.some((r) => r.status === "completed") && (
            <button
              onClick={() => setShowDeleteConfirm("completed")}
              style={{
                width: "100%",
                padding: "6px 10px",
                borderRadius: 6,
                border: `1px solid rgba(239,68,68,0.2)`,
                background: "rgba(239,68,68,0.05)",
                color: "#EF4444",
                fontSize: 11,
                cursor: "pointer",
                marginBottom: 8,
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <Trash2 size={11} />
              Delete All Completed
            </button>
          )}

          {/* All Results button */}
          <div
            onClick={() => setSelectedResearch(null)}
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              background: !selectedResearch ? `${ROSE_GOLD}10` : "transparent",
              border: !selectedResearch ? `1px solid ${ROSE_GOLD}30` : `1px solid transparent`,
              cursor: "pointer",
              marginBottom: 4,
              transition: "all 0.2s",
            }}
          >
            <span style={{ fontSize: 13, color: !selectedResearch ? ROSE_GOLD : TEXT_SECONDARY, fontWeight: 500 }}>
              All Results
            </span>
          </div>

          <div style={{ marginTop: 8 }}>
            {filteredResearches.map((r) => {
              const active = selectedResearch === r.id
              const catColor = CATEGORY_COLORS[r.category] || TEXT_SECONDARY
              const statusDot = r.status === "active" ? "#22C55E" : r.status === "paused" ? "#F59E0B" : r.status === "archived" ? "#818CF8" : TEXT_TERTIARY

              return (
                <div
                  key={r.id}
                  onClick={() => { if (!bulkSelect) setSelectedResearch(r.id) }}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    setContextMenu({ id: r.id, x: e.clientX, y: e.clientY })
                  }}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 8,
                    background: active ? `${catColor}10` : "transparent",
                    border: active ? `1px solid ${catColor}30` : "1px solid transparent",
                    cursor: "pointer",
                    marginBottom: 2,
                    transition: "all 0.2s",
                    opacity: r.archived ? 0.6 : 1,
                  }}
                >
                  <div className="flex items-center gap-2">
                    {bulkSelect && (
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleBulkId(r.id) }}
                        style={{
                          width: 16, height: 16, borderRadius: 3, flexShrink: 0,
                          border: selectedIds.has(r.id) ? `1px solid ${ROSE_GOLD}` : `1px solid ${CARD_BORDER}`,
                          background: selectedIds.has(r.id) ? ROSE_GOLD : "transparent",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          cursor: "pointer", fontSize: 10, color: VOID,
                        }}
                      >
                        {selectedIds.has(r.id) && <Check size={10} />}
                      </button>
                    )}
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: statusDot, flexShrink: 0 }} />
                    <span style={{
                      fontSize: 13,
                      color: active ? TEXT_PRIMARY : TEXT_SECONDARY,
                      fontWeight: r.unreadCount > 0 ? 600 : 400,
                      flex: 1,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}>
                      {r.title}
                    </span>
                    {r.unreadCount > 0 && (
                      <span style={{
                        fontSize: 10,
                        padding: "1px 6px",
                        borderRadius: 10,
                        background: `${catColor}20`,
                        color: catColor,
                        fontWeight: 600,
                      }}>
                        {r.unreadCount}
                      </span>
                    )}
                  </div>

                  {/* Date + type info */}
                  <div className="flex items-center gap-2 flex-wrap" style={{ marginTop: 4 }}>
                    <span style={{
                      fontSize: 10,
                      padding: "1px 6px",
                      borderRadius: 4,
                      background: r.type === "recurring" ? "rgba(129,140,248,0.12)" : "rgba(255,255,255,0.06)",
                      color: r.type === "recurring" ? "#818CF8" : TEXT_TERTIARY,
                    }}>
                      {r.type === "recurring" ? `↻ ${r.frequency}` : "one-time"}
                    </span>
                    <span style={{ fontSize: 10, color: TEXT_TERTIARY }}>{r.resultCount} results</span>
                    <span style={{ fontSize: 10, color: TEXT_TERTIARY, marginLeft: "auto" }}>
                      {formatDateShort(r.createdAt)}
                    </span>
                  </div>

                  {/* Last run / next run */}
                  {r.lastRunAt && (
                    <div style={{ fontSize: 10, color: TEXT_TERTIARY, marginTop: 2 }}>
                      Last: {formatDate(r.lastRunAt)}
                      {r.type === "recurring" && r.nextRunAt && ` · Next: ${formatDate(r.nextRunAt)}`}
                    </div>
                  )}

                  {/* Action buttons - only show when not in bulk mode */}
                  {!bulkSelect && (
                    <div className="flex items-center gap-2" style={{ marginTop: 6 }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); runResearch(r.id) }}
                        disabled={runningId === r.id}
                        style={{
                          fontSize: 10,
                          padding: "2px 8px",
                          borderRadius: 4,
                          border: `1px solid ${CARD_BORDER}`,
                          background: "transparent",
                          color: runningId === r.id ? ROSE_GOLD : TEXT_TERTIARY,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 3,
                        }}
                      >
                        {runningId === r.id ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
                        {runningId === r.id ? "Running..." : "Run"}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); pauseResearch(r.id, r.status) }}
                        style={{
                          fontSize: 10,
                          padding: "2px 8px",
                          borderRadius: 4,
                          border: `1px solid ${CARD_BORDER}`,
                          background: "transparent",
                          color: TEXT_TERTIARY,
                          cursor: "pointer",
                        }}
                      >
                        {r.status === "paused" ? "Resume" : "Pause"}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); archiveResearch(r.id) }}
                        style={{
                          fontSize: 10,
                          padding: "2px 8px",
                          borderRadius: 4,
                          border: `1px solid ${CARD_BORDER}`,
                          background: "transparent",
                          color: "#818CF8",
                          cursor: "pointer",
                        }}
                      >
                        Archive
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(r.id) }}
                        style={{
                          fontSize: 10,
                          padding: "2px 8px",
                          borderRadius: 4,
                          border: `1px solid ${CARD_BORDER}`,
                          background: "transparent",
                          color: "#EF4444",
                          cursor: "pointer",
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              )
            })}

            {filteredResearches.length === 0 && (
              <div style={{ padding: "40px 20px", textAlign: "center", color: TEXT_TERTIARY, fontSize: 13 }}>
                {viewMode === "mine" ? "No researches by you yet." : "No researches yet."}
                <br />
                Click &quot;+ New Research&quot; to start.
              </div>
            )}
          </div>
        </div>

        {/* Main area — results feed */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Filter & Sort bar */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 12,
            padding: "8px 12px",
            borderRadius: 8,
            background: "rgba(255,255,255,0.02)",
            border: `1px solid ${CARD_BORDER}`,
            flexWrap: "wrap",
          }}>
            <Filter size={13} style={{ color: TEXT_TERTIARY }} />
            {FILTER_OPTIONS.map((f) => (
              <button
                key={f.value}
                onClick={() => setResultFilter(f.value)}
                style={{
                  padding: "3px 10px",
                  borderRadius: 14,
                  border: resultFilter === f.value ? `1px solid ${ROSE_GOLD}` : `1px solid transparent`,
                  background: resultFilter === f.value ? `${ROSE_GOLD}15` : "transparent",
                  color: resultFilter === f.value ? ROSE_GOLD : TEXT_TERTIARY,
                  fontSize: 11,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {f.label}
              </button>
            ))}

            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
              <SortAsc size={13} style={{ color: TEXT_TERTIARY }} />
              <select
                value={resultSort}
                onChange={(e) => setResultSort(e.target.value)}
                style={{
                  padding: "2px 8px",
                  borderRadius: 6,
                  border: `1px solid ${CARD_BORDER}`,
                  background: "#0A0C10",
                  color: TEXT_SECONDARY,
                  fontSize: 11,
                  outline: "none",
                }}
              >
                {SORT_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>

              {/* Export */}
              <button
                onClick={() => exportResults("csv")}
                style={{
                  display: "flex", alignItems: "center", gap: 3,
                  padding: "3px 8px", borderRadius: 6,
                  border: `1px solid ${CARD_BORDER}`, background: "transparent",
                  color: TEXT_TERTIARY, fontSize: 10, cursor: "pointer",
                }}
              >
                <Download size={10} />
                CSV
              </button>
            </div>
          </div>

          {loading ? (
            <div style={{ padding: "60px 0", textAlign: "center" }}>
              <Loader2 size={24} className="animate-spin" style={{ color: ROSE_GOLD, margin: "0 auto" }} />
              <p style={{ color: TEXT_TERTIARY, fontSize: 13, marginTop: 12 }}>Sentinel is researching...</p>
            </div>
          ) : results.length === 0 ? (
            <div style={{ padding: "60px 0", textAlign: "center", color: TEXT_TERTIARY }}>
              <Sparkles size={32} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
              <p style={{ fontSize: 14 }}>No intel results yet</p>
              <p style={{ fontSize: 12 }}>Launch a research to populate the feed</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {/* Quality indicator */}
              {results.length > 0 && (() => {
                const critical = results.filter((r) => r.relevance === "critical").length
                const high = results.filter((r) => r.relevance === "high").length
                const medium = results.filter((r) => r.relevance === "medium").length
                const low = results.filter((r) => r.relevance === "low").length
                const total = results.length
                return (
                  <div style={{
                    padding: "10px 14px", borderRadius: 8, marginBottom: 8,
                    background: "rgba(255,255,255,0.02)", border: `1px solid ${CARD_BORDER}`,
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    flexWrap: "wrap", gap: 8,
                  }}>
                    <div className="flex items-center gap-3" style={{ fontSize: 11 }}>
                      <span style={{ color: TEXT_SECONDARY }}>{total} results</span>
                      {critical > 0 && <span style={{ color: "#EF4444" }}>{critical} critical</span>}
                      {high > 0 && <span style={{ color: "#F87171" }}>{high} high</span>}
                      {medium > 0 && <span style={{ color: "#F59E0B" }}>{medium} medium</span>}
                      {low > 0 && <span style={{ color: TEXT_TERTIARY }}>{low} low</span>}
                    </div>
                    <span style={{ fontSize: 10, color: TEXT_TERTIARY, fontStyle: "italic" }}>
                      Based on AI analysis — not live web data. Perplexity API integration coming soon.
                    </span>
                  </div>
                )
              })()}

              {/* Results grouped by date */}
              {resultGroups.map((group) => (
                <div key={group.date}>
                  {/* Date separator */}
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    margin: "12px 0 8px",
                  }}>
                    <span style={{ fontSize: 11, color: TEXT_TERTIARY, fontWeight: 600, whiteSpace: "nowrap" }}>
                      {group.date}
                    </span>
                    <div style={{ flex: 1, height: 1, background: CARD_BORDER }} />
                    <span style={{ fontSize: 10, color: TEXT_TERTIARY }}>{group.results.length} items</span>
                  </div>

                  {group.results.map((r) => {
                    const catColor = CATEGORY_COLORS[r.research.category] || TEXT_SECONDARY
                    const sentColor = SENTIMENT_COLORS[r.sentiment || "neutral"]
                    const relColor = RELEVANCE_COLORS[r.relevance]
                    const expanded = expandedResult === r.id
                    const meta = r.metadata as Record<string, unknown> | null
                    const isConference = r.research.category === "conferences"
                    const isAccepted = meta?.accepted === true
                    const isRejected = meta?.rejected === true
                    const isMarketing = r.research.category === "marketing"
                    const isCritical = r.relevance === "critical"
                    const isHovered = hoveredResult === r.id

                    return (
                      <div
                        key={r.id}
                        onClick={() => { if (!r.read) markRead(r.id); setExpandedResult(expanded ? null : r.id) }}
                        onMouseEnter={() => setHoveredResult(r.id)}
                        onMouseLeave={() => setHoveredResult(null)}
                        style={{
                          padding: "14px 18px",
                          borderRadius: 10,
                          background: CARD_BG,
                          border: `1px solid ${isCritical ? "rgba(239,68,68,0.3)" : CARD_BORDER}`,
                          cursor: "pointer",
                          transition: "all 0.2s",
                          borderLeft: !r.read ? `3px solid ${catColor}` : `3px solid transparent`,
                          position: "relative",
                          marginBottom: 8,
                        }}
                      >
                        {/* Critical pulse */}
                        {isCritical && (
                          <span style={{
                            position: "absolute",
                            top: 14,
                            right: 14,
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: "#EF4444",
                            animation: "pulse 2s infinite",
                          }} />
                        )}

                        {/* Top row */}
                        <div className="flex items-start gap-3">
                          {/* Source icon */}
                          <div style={{
                            width: 28,
                            height: 28,
                            borderRadius: 6,
                            background: `${catColor}15`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: catColor,
                            flexShrink: 0,
                          }}>
                            {SOURCE_ICONS[r.sourceType || ""] || <Globe size={14} />}
                          </div>

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="flex items-center gap-2">
                              <span style={{
                                fontSize: 14,
                                fontWeight: r.read ? 400 : 600,
                                color: TEXT_PRIMARY,
                                flex: 1,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: expanded ? "normal" : "nowrap",
                              }}>
                                {r.title}
                              </span>
                              <button
                                onClick={(e) => { e.stopPropagation(); toggleStar(r.id, r.starred) }}
                                style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
                              >
                                <Star size={14} fill={r.starred ? "#F59E0B" : "none"} color={r.starred ? "#F59E0B" : TEXT_TERTIARY} />
                              </button>
                            </div>

                            {/* Badges row */}
                            <div className="flex items-center gap-2 flex-wrap" style={{ marginTop: 6 }}>
                              <span style={{
                                fontSize: 10,
                                padding: "1px 6px",
                                borderRadius: 4,
                                background: `${catColor}15`,
                                color: catColor,
                              }}>
                                {CATEGORY_ICONS[r.research.category]} {CATEGORY_LABELS[r.research.category]}
                              </span>
                              {r.sourceType && (
                                <span style={{
                                  fontSize: 10,
                                  padding: "1px 6px",
                                  borderRadius: 4,
                                  background: "rgba(255,255,255,0.06)",
                                  color: TEXT_TERTIARY,
                                }}>
                                  {r.sourceType}
                                </span>
                              )}
                              <span style={{
                                fontSize: 10,
                                padding: "1px 6px",
                                borderRadius: 4,
                                background: sentColor.bg,
                                color: sentColor.text,
                              }}>
                                {r.sentiment}
                              </span>
                              <span style={{
                                fontSize: 10,
                                padding: "1px 6px",
                                borderRadius: 4,
                                background: relColor.bg,
                                color: relColor.text,
                                fontWeight: isCritical ? 700 : 400,
                              }}>
                                {r.relevance}
                              </span>
                              {r.actionable && (
                                <span style={{
                                  fontSize: 10,
                                  padding: "1px 6px",
                                  borderRadius: 4,
                                  background: "rgba(245,158,11,0.12)",
                                  color: "#F59E0B",
                                }}>
                                  ⚡ actionable
                                </span>
                              )}
                              {isAccepted && (
                                <span style={{
                                  fontSize: 10,
                                  padding: "1px 6px",
                                  borderRadius: 4,
                                  background: "rgba(34,197,94,0.15)",
                                  color: "#22C55E",
                                  fontWeight: 600,
                                }}>
                                  ✅ Accepted{meta?.attendees ? ` — ${(meta.attendees as string[]).join(", ")}` : ""}
                                </span>
                              )}
                              {isRejected && (
                                <span style={{
                                  fontSize: 10,
                                  padding: "1px 6px",
                                  borderRadius: 4,
                                  background: "rgba(239,68,68,0.12)",
                                  color: "#EF4444",
                                }}>
                                  ❌ Rejected
                                </span>
                              )}
                              <span style={{ fontSize: 10, color: TEXT_TERTIARY, marginLeft: "auto" }}>
                                {formatDate(r.createdAt)}
                              </span>
                            </div>

                            {/* Summary */}
                            <p style={{
                              fontSize: 13,
                              color: TEXT_SECONDARY,
                              lineHeight: 1.5,
                              marginTop: 8,
                              display: expanded ? "block" : "-webkit-box",
                              WebkitLineClamp: expanded ? undefined : 2,
                              WebkitBoxOrient: "vertical",
                              overflow: expanded ? "visible" : "hidden",
                            }}>
                              {r.summary}
                            </p>

                            {/* Hover action buttons — visible on hover at bottom of collapsed card */}
                            {isHovered && !expanded && (
                              <div className="flex items-center gap-2" style={{ marginTop: 8, paddingTop: 6, borderTop: `1px solid ${CARD_BORDER}` }}>
                                <button
                                  onClick={(e) => { e.stopPropagation(); window.open(`/ai?contactName=${encodeURIComponent(r.title)}`, "_blank") }}
                                  style={{ display: "flex", alignItems: "center", gap: 3, padding: "3px 8px", borderRadius: 5, border: `1px solid ${CARD_BORDER}`, background: "transparent", color: "#818CF8", fontSize: 10, cursor: "pointer" }}
                                >
                                  <Sparkles size={10} /> Deep Dive
                                </button>
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation()
                                    try {
                                      await fetch("/api/tasks", {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({
                                          title: `[Intel] ${r.title}`,
                                          description: r.summary,
                                          tag: "compliance",
                                          priority: r.relevance === "critical" ? "urgent" : r.relevance === "high" ? "high" : "medium",
                                        }),
                                      })
                                      alert("Task created!")
                                    } catch { /* empty */ }
                                  }}
                                  style={{ display: "flex", alignItems: "center", gap: 3, padding: "3px 8px", borderRadius: 5, border: `1px solid ${CARD_BORDER}`, background: "transparent", color: "#F59E0B", fontSize: 10, cursor: "pointer" }}
                                >
                                  <CheckCircle size={10} /> Task
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); dismissResult(r.id) }}
                                  style={{ display: "flex", alignItems: "center", gap: 3, padding: "3px 8px", borderRadius: 5, border: `1px solid ${CARD_BORDER}`, background: "transparent", color: TEXT_TERTIARY, fontSize: 10, cursor: "pointer" }}
                                >
                                  <XCircle size={10} /> Dismiss
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    fetch(`/api/intel/results/${r.id}`, {
                                      method: "PATCH",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ read: !r.read }),
                                    })
                                    setResults((prev) => prev.map((x) => (x.id === r.id ? { ...x, read: !r.read } : x)))
                                  }}
                                  style={{ display: "flex", alignItems: "center", gap: 3, padding: "3px 8px", borderRadius: 5, border: `1px solid ${CARD_BORDER}`, background: "transparent", color: TEXT_TERTIARY, fontSize: 10, cursor: "pointer" }}
                                >
                                  {r.read ? <EyeOff size={10} /> : <Eye size={10} />}
                                  {r.read ? "Unread" : "Read"}
                                </button>
                              </div>
                            )}

                            {/* Expanded details */}
                            {expanded && (
                              <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${CARD_BORDER}` }}>
                                {/* Metadata */}
                                {meta && Object.keys(meta).filter(k => !["accepted","rejected","rejectionReason","attendees","eventId","wikiPageSlug"].includes(k)).length > 0 && (
                                  <div style={{ marginBottom: 12 }}>
                                    {Object.entries(meta)
                                      .filter(([k]) => !["accepted","rejected","rejectionReason","attendees","eventId","wikiPageSlug"].includes(k))
                                      .map(([k, v]) => (
                                        <div key={k} className="flex items-center gap-2" style={{ marginBottom: 2 }}>
                                          <span style={{ fontSize: 11, color: TEXT_TERTIARY, textTransform: "capitalize" }}>{k.replace(/_/g, " ")}:</span>
                                          <span style={{ fontSize: 11, color: TEXT_SECONDARY }}>{String(v)}</span>
                                        </div>
                                      ))}
                                  </div>
                                )}

                                {/* Source link */}
                                {r.source && (
                                  <a
                                    href={r.source.startsWith("http") ? r.source : `https://${r.source}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: 4,
                                      fontSize: 11,
                                      color: ROSE_GOLD,
                                      textDecoration: "none",
                                      marginBottom: 12,
                                    }}
                                  >
                                    <ExternalLink size={11} />
                                    {r.source.length > 60 ? r.source.slice(0, 60) + "..." : r.source}
                                  </a>
                                )}

                                {/* Action buttons row */}
                                <div className="flex items-center gap-2 flex-wrap">
                                  {/* Conference actions */}
                                  {isConference && !isAccepted && !isRejected && (
                                    <>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); setShowConferenceModal(r.id) }}
                                        style={{
                                          display: "flex", alignItems: "center", gap: 4,
                                          padding: "4px 10px", borderRadius: 6,
                                          border: "none", background: "rgba(34,197,94,0.15)",
                                          color: "#22C55E", fontSize: 11, cursor: "pointer",
                                        }}
                                      >
                                        <CheckCircle size={12} />
                                        Accept — Add to Calendar
                                      </button>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); rejectConference(r.id) }}
                                        style={{
                                          display: "flex", alignItems: "center", gap: 4,
                                          padding: "4px 10px", borderRadius: 6,
                                          border: "none", background: "rgba(239,68,68,0.12)",
                                          color: "#EF4444", fontSize: 11, cursor: "pointer",
                                        }}
                                      >
                                        <XCircle size={12} />
                                        Reject
                                      </button>
                                    </>
                                  )}

                                  {/* Marketing actions */}
                                  {isMarketing && r.research.subcategory === "competitive_intel" && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); window.open("https://www.linkedin.com/feed/", "_blank") }}
                                      style={{
                                        display: "flex", alignItems: "center", gap: 4,
                                        padding: "4px 10px", borderRadius: 6,
                                        border: "none", background: "rgba(192,139,136,0.15)",
                                        color: ROSE_GOLD, fontSize: 11, cursor: "pointer",
                                      }}
                                    >
                                      <Megaphone size={12} />
                                      Inspire New Post
                                    </button>
                                  )}

                                  {isMarketing && (r.research.subcategory === "content_ideas" || r.research.subcategory === "repost_suggestions") && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); window.open("https://www.linkedin.com/feed/", "_blank") }}
                                      style={{
                                        display: "flex", alignItems: "center", gap: 4,
                                        padding: "4px 10px", borderRadius: 6,
                                        border: "none", background: "rgba(192,139,136,0.15)",
                                        color: ROSE_GOLD, fontSize: 11, cursor: "pointer",
                                      }}
                                    >
                                      <TrendingUp size={12} />
                                      Open on LinkedIn
                                    </button>
                                  )}

                                  {/* Deep Dive */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      window.open(`/ai?contactName=${encodeURIComponent(r.title)}`, "_blank")
                                    }}
                                    style={{
                                      display: "flex", alignItems: "center", gap: 4,
                                      padding: "4px 10px", borderRadius: 6,
                                      border: `1px solid ${CARD_BORDER}`, background: "transparent",
                                      color: "#818CF8", fontSize: 11, cursor: "pointer",
                                    }}
                                  >
                                    <Sparkles size={12} />
                                    Deep Dive
                                  </button>

                                  {/* Create Task */}
                                  <button
                                    onClick={async (e) => {
                                      e.stopPropagation()
                                      try {
                                        await fetch("/api/tasks", {
                                          method: "POST",
                                          headers: { "Content-Type": "application/json" },
                                          body: JSON.stringify({
                                            title: `[Intel] ${r.title}`,
                                            description: r.summary,
                                            tag: "compliance",
                                            priority: r.relevance === "critical" ? "urgent" : r.relevance === "high" ? "high" : "medium",
                                          }),
                                        })
                                        alert("Task created!")
                                      } catch { /* empty */ }
                                    }}
                                    style={{
                                      display: "flex", alignItems: "center", gap: 4,
                                      padding: "4px 10px", borderRadius: 6,
                                      border: `1px solid ${CARD_BORDER}`, background: "transparent",
                                      color: "#F59E0B", fontSize: 11, cursor: "pointer",
                                    }}
                                  >
                                    <CheckCircle size={12} />
                                    Create Task
                                  </button>

                                  {/* Add to Wiki */}
                                  <button
                                    onClick={async (e) => {
                                      e.stopPropagation()
                                      const slug = r.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 80)
                                      try {
                                        await fetch("/api/wiki", {
                                          method: "POST",
                                          headers: { "Content-Type": "application/json" },
                                          body: JSON.stringify({
                                            title: r.title,
                                            slug,
                                            content: { type: "doc", content: [
                                              { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: r.title }] },
                                              { type: "paragraph", content: [{ type: "text", text: r.summary }] },
                                              ...(r.source ? [{ type: "paragraph", content: [{ type: "text", text: `Source: ${r.source}` }] }] : []),
                                            ]},
                                            category: "Intel",
                                            icon: CATEGORY_ICONS[r.research.category] || "🔍",
                                          }),
                                        })
                                        alert("Wiki page created!")
                                      } catch { /* empty */ }
                                    }}
                                    style={{
                                      display: "flex", alignItems: "center", gap: 4,
                                      padding: "4px 10px", borderRadius: 6,
                                      border: `1px solid ${CARD_BORDER}`, background: "transparent",
                                      color: "#5BB8A8", fontSize: 11, cursor: "pointer",
                                    }}
                                  >
                                    <FileText size={12} />
                                    Add to Wiki
                                  </button>

                                  {/* Dismiss */}
                                  <button
                                    onClick={(e) => { e.stopPropagation(); dismissResult(r.id) }}
                                    style={{
                                      display: "flex", alignItems: "center", gap: 4,
                                      padding: "4px 10px", borderRadius: 6,
                                      border: `1px solid ${CARD_BORDER}`, background: "transparent",
                                      color: TEXT_TERTIARY, fontSize: 11, cursor: "pointer",
                                    }}
                                  >
                                    <XCircle size={12} />
                                    Dismiss
                                  </button>

                                  {/* Share via Telegram */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      const text = encodeURIComponent(`📊 Intel: ${r.title}\n\n${r.summary.slice(0, 300)}${r.summary.length > 300 ? "..." : ""}${r.source ? `\n\n🔗 ${r.source}` : ""}`)
                                      window.open(`https://t.me/share/url?url=${encodeURIComponent(r.source || "")}&text=${text}`, "_blank")
                                    }}
                                    style={{
                                      display: "flex", alignItems: "center", gap: 4,
                                      padding: "4px 10px", borderRadius: 6,
                                      border: `1px solid ${CARD_BORDER}`, background: "transparent",
                                      color: "#29B6F6", fontSize: 11, cursor: "pointer",
                                    }}
                                  >
                                    <Send size={12} />
                                    Telegram
                                  </button>

                                  {/* Read/unread toggle */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      fetch(`/api/intel/results/${r.id}`, {
                                        method: "PATCH",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ read: !r.read }),
                                      })
                                      setResults((prev) => prev.map((x) => (x.id === r.id ? { ...x, read: !r.read } : x)))
                                    }}
                                    style={{
                                      display: "flex", alignItems: "center", gap: 4,
                                      padding: "4px 10px", borderRadius: 6,
                                      border: `1px solid ${CARD_BORDER}`, background: "transparent",
                                      color: TEXT_TERTIARY, fontSize: 11, cursor: "pointer",
                                    }}
                                  >
                                    {r.read ? <EyeOff size={12} /> : <Eye size={12} />}
                                    {r.read ? "Mark unread" : "Mark read"}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right-click context menu */}
      {contextMenu && (
        <div style={{
          position: "fixed",
          top: contextMenu.y,
          left: contextMenu.x,
          zIndex: 200,
          background: "rgba(15,17,24,0.6)",
          border: `1px solid ${CARD_BORDER}`,
          borderRadius: 8,
          padding: 4,
          minWidth: 140,
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        }}>
          <button
            onClick={() => { runResearch(contextMenu.id); setContextMenu(null) }}
            style={{ width: "100%", padding: "6px 12px", borderRadius: 6, border: "none", background: "transparent", color: TEXT_SECONDARY, fontSize: 12, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 6 }}
          >
            <RefreshCw size={12} /> Run
          </button>
          <button
            onClick={() => { archiveResearch(contextMenu.id); setContextMenu(null) }}
            style={{ width: "100%", padding: "6px 12px", borderRadius: 6, border: "none", background: "transparent", color: "#818CF8", fontSize: 12, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 6 }}
          >
            <Archive size={12} /> Archive
          </button>
          <button
            onClick={() => { setShowDeleteConfirm(contextMenu.id); setContextMenu(null) }}
            style={{ width: "100%", padding: "6px 12px", borderRadius: 6, border: "none", background: "transparent", color: "#EF4444", fontSize: 12, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 6 }}
          >
            <Trash2 size={12} /> Delete
          </button>
        </div>
      )}

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            backdropFilter: "blur(8px)",
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() => setShowDeleteConfirm(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 400,
              background: "rgba(15,17,24,0.6)",
              border: `1px solid ${CARD_BORDER}`,
              borderRadius: 14,
              padding: 28,
            }}
          >
            <div className="flex items-center gap-3" style={{ marginBottom: 16 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(239,68,68,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <AlertTriangle size={18} color="#EF4444" />
              </div>
              <h3 style={{ fontFamily: "'Bellfair', serif", fontSize: 18, color: TEXT_PRIMARY, margin: 0 }}>
                Confirm Delete
              </h3>
            </div>
            <p style={{ fontSize: 13, color: TEXT_SECONDARY, marginBottom: 20, lineHeight: 1.6 }}>
              {showDeleteConfirm === "completed"
                ? "This will permanently delete all completed researches and their results. This action cannot be undone."
                : "This will permanently delete this research and all its results. This action cannot be undone."}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                style={{
                  flex: 1,
                  padding: "8px 0",
                  borderRadius: 8,
                  border: `1px solid ${CARD_BORDER}`,
                  background: "transparent",
                  color: TEXT_SECONDARY,
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (showDeleteConfirm === "completed") {
                    deleteAllCompleted()
                  } else {
                    deleteResearch(showDeleteConfirm)
                    setShowDeleteConfirm(null)
                  }
                }}
                style={{
                  flex: 1,
                  padding: "8px 0",
                  borderRadius: 8,
                  border: "none",
                  background: "rgba(239,68,68,0.2)",
                  color: "#EF4444",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Research Modal */}
      {showModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            backdropFilter: "blur(8px)",
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 520,
              maxHeight: "85vh",
              overflowY: "auto",
              background: "rgba(15,17,24,0.6)",
              border: `1px solid ${CARD_BORDER}`,
              borderRadius: 14,
              padding: 28,
            }}
          >
            <div className="flex items-center justify-between" style={{ marginBottom: 24 }}>
              <h2 style={{ fontFamily: "'Bellfair', serif", fontSize: 22, color: TEXT_PRIMARY, margin: 0 }}>
                New Research
              </h2>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: TEXT_TERTIARY }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Title */}
            <label style={{ display: "block", marginBottom: 16 }}>
              <span style={{ fontSize: 12, color: TEXT_SECONDARY, display: "block", marginBottom: 6 }}>Title *</span>
              <input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="e.g. Monitor Mercury pricing changes"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: `1px solid ${CARD_BORDER}`,
                  background: CARD_BG,
                  color: TEXT_PRIMARY,
                  fontSize: 13,
                  outline: "none",
                }}
              />
            </label>

            {/* Category */}
            <label style={{ display: "block", marginBottom: 16 }}>
              <span style={{ fontSize: 12, color: TEXT_SECONDARY, display: "block", marginBottom: 6 }}>Category *</span>
              <select
                value={formCategory}
                onChange={(e) => { setFormCategory(e.target.value); setFormSubcategory("") }}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: `1px solid ${CARD_BORDER}`,
                  background: "#0A0C10",
                  color: TEXT_PRIMARY,
                  fontSize: 13,
                  outline: "none",
                }}
              >
                {Object.entries(CATEGORY_LABELS).filter(([k]) => k !== "all").map(([k, v]) => (
                  <option key={k} value={k}>{CATEGORY_ICONS[k]} {v}</option>
                ))}
              </select>
            </label>

            {/* Subcategory */}
            {SUBCATEGORIES[formCategory] && (
              <label style={{ display: "block", marginBottom: 16 }}>
                <span style={{ fontSize: 12, color: TEXT_SECONDARY, display: "block", marginBottom: 6 }}>Subcategory</span>
                <select
                  value={formSubcategory}
                  onChange={(e) => {
                    const val = e.target.value
                    setFormSubcategory(val)
                    if (val && SOURCE_PRESETS[val]) setFormSources(SOURCE_PRESETS[val])
                    if (val && PREFILLED_QUERIES[val]) setFormQuery(PREFILLED_QUERIES[val])
                  }}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: `1px solid ${CARD_BORDER}`,
                    background: "#0A0C10",
                    color: TEXT_PRIMARY,
                    fontSize: 13,
                    outline: "none",
                  }}
                >
                  <option value="">Select subcategory...</option>
                  {SUBCATEGORIES[formCategory].map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </label>
            )}

            {/* Sources */}
            <div style={{ marginBottom: 16 }}>
              <span style={{ fontSize: 12, color: TEXT_SECONDARY, display: "block", marginBottom: 6 }}>Where to search?</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {ALL_SOURCES.map((src) => {
                  const checked = formSources.includes(src.value)
                  return (
                    <button
                      key={src.value}
                      type="button"
                      onClick={() => {
                        setFormSources((prev) =>
                          checked ? prev.filter((s) => s !== src.value) : [...prev, src.value]
                        )
                      }}
                      style={{
                        padding: "4px 10px",
                        borderRadius: 6,
                        border: checked ? `1px solid ${ROSE_GOLD}` : `1px solid ${CARD_BORDER}`,
                        background: checked ? `${ROSE_GOLD}15` : "transparent",
                        color: checked ? ROSE_GOLD : TEXT_TERTIARY,
                        fontSize: 11,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        transition: "all 0.15s",
                      }}
                    >
                      <span style={{ width: 12, height: 12, borderRadius: 3, border: checked ? `1px solid ${ROSE_GOLD}` : `1px solid ${CARD_BORDER}`, background: checked ? ROSE_GOLD : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, color: VOID }}>
                        {checked && "✓"}
                      </span>
                      {src.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Keywords */}
            <div style={{ marginBottom: 16 }}>
              <span style={{ fontSize: 12, color: TEXT_SECONDARY, display: "block", marginBottom: 6 }}>Keywords to monitor</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: formKeywords.length > 0 ? 8 : 0 }}>
                {formKeywords.map((kw, i) => (
                  <span key={i} style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    padding: "2px 8px", borderRadius: 4,
                    background: `${ROSE_GOLD}15`, color: ROSE_GOLD, fontSize: 11,
                  }}>
                    {kw}
                    <button
                      type="button"
                      onClick={() => setFormKeywords((prev) => prev.filter((_, idx) => idx !== i))}
                      style={{ background: "none", border: "none", cursor: "pointer", color: ROSE_GOLD, fontSize: 12, padding: 0, lineHeight: 1 }}
                    >×</button>
                  </span>
                ))}
              </div>
              <input
                value={formKeywordInput}
                onChange={(e) => setFormKeywordInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && formKeywordInput.trim()) {
                    e.preventDefault()
                    setFormKeywords((prev) => [...prev, formKeywordInput.trim()])
                    setFormKeywordInput("")
                  }
                }}
                placeholder="Add keywords... (press Enter)"
                style={{
                  width: "100%", padding: "8px 12px", borderRadius: 8,
                  border: `1px solid ${CARD_BORDER}`, background: CARD_BG,
                  color: TEXT_PRIMARY, fontSize: 13, outline: "none",
                }}
              />
            </div>

            {/* Companies */}
            <div style={{ marginBottom: 16 }}>
              <span style={{ fontSize: 12, color: TEXT_SECONDARY, display: "block", marginBottom: 6 }}>Companies to monitor</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: formCompanies.length > 0 ? 8 : 0 }}>
                {formCompanies.map((c, i) => (
                  <span key={i} style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    padding: "2px 8px", borderRadius: 4,
                    background: "rgba(129,140,248,0.12)", color: "#818CF8", fontSize: 11,
                  }}>
                    {c}
                    <button
                      type="button"
                      onClick={() => setFormCompanies((prev) => prev.filter((_, idx) => idx !== i))}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#818CF8", fontSize: 12, padding: 0, lineHeight: 1 }}
                    >×</button>
                  </span>
                ))}
              </div>
              <input
                value={formCompanyInput}
                onChange={(e) => setFormCompanyInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && formCompanyInput.trim()) {
                    e.preventDefault()
                    setFormCompanies((prev) => [...prev, formCompanyInput.trim()])
                    setFormCompanyInput("")
                  }
                }}
                placeholder="Add company names..."
                style={{
                  width: "100%", padding: "8px 12px", borderRadius: 8,
                  border: `1px solid ${CARD_BORDER}`, background: CARD_BG,
                  color: TEXT_PRIMARY, fontSize: 13, outline: "none",
                }}
              />
            </div>

            {/* Regions */}
            <div style={{ marginBottom: 16 }}>
              <span style={{ fontSize: 12, color: TEXT_SECONDARY, display: "block", marginBottom: 6 }}>Geographic focus</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {ALL_REGIONS.map((reg) => {
                  const checked = formRegions.includes(reg.value)
                  return (
                    <button
                      key={reg.value}
                      type="button"
                      onClick={() => {
                        setFormRegions((prev) =>
                          checked ? prev.filter((r) => r !== reg.value) : [...prev, reg.value]
                        )
                      }}
                      style={{
                        padding: "4px 10px",
                        borderRadius: 6,
                        border: checked ? "1px solid #22C55E" : `1px solid ${CARD_BORDER}`,
                        background: checked ? "rgba(34,197,94,0.1)" : "transparent",
                        color: checked ? "#22C55E" : TEXT_TERTIARY,
                        fontSize: 11,
                        cursor: "pointer",
                        transition: "all 0.15s",
                      }}
                    >
                      {reg.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Language */}
            <label style={{ display: "block", marginBottom: 16 }}>
              <span style={{ fontSize: 12, color: TEXT_SECONDARY, display: "block", marginBottom: 6 }}>Content language</span>
              <select
                value={formLanguage}
                onChange={(e) => setFormLanguage(e.target.value)}
                style={{
                  width: "100%", padding: "8px 12px", borderRadius: 8,
                  border: `1px solid ${CARD_BORDER}`, background: "#0A0C10",
                  color: TEXT_PRIMARY, fontSize: 13, outline: "none",
                }}
              >
                <option value="english">English</option>
                <option value="french">French</option>
                <option value="all">All Languages</option>
              </select>
            </label>

            {/* Query */}
            <label style={{ display: "block", marginBottom: 16 }}>
              <span style={{ fontSize: 12, color: TEXT_SECONDARY, display: "block", marginBottom: 6 }}>Research Query</span>
              <textarea
                value={formQuery}
                onChange={(e) => setFormQuery(e.target.value)}
                placeholder="Describe what to look for in detail..."
                rows={4}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: `1px solid ${CARD_BORDER}`,
                  background: CARD_BG,
                  color: TEXT_PRIMARY,
                  fontSize: 13,
                  outline: "none",
                  resize: "vertical",
                }}
              />
            </label>

            {/* Type toggle */}
            <div style={{ marginBottom: 16 }}>
              <span style={{ fontSize: 12, color: TEXT_SECONDARY, display: "block", marginBottom: 6 }}>Type</span>
              <div className="flex gap-2">
                {["one_time", "recurring"].map((t) => (
                  <button
                    key={t}
                    onClick={() => setFormType(t)}
                    style={{
                      flex: 1,
                      padding: "8px 0",
                      borderRadius: 8,
                      border: formType === t ? `1px solid ${ROSE_GOLD}` : `1px solid ${CARD_BORDER}`,
                      background: formType === t ? `${ROSE_GOLD}15` : "transparent",
                      color: formType === t ? ROSE_GOLD : TEXT_SECONDARY,
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: "pointer",
                    }}
                  >
                    {t === "one_time" ? "One-Time" : "Recurring"}
                  </button>
                ))}
              </div>
            </div>

            {/* Frequency */}
            {formType === "recurring" && (
              <label style={{ display: "block", marginBottom: 16 }}>
                <span style={{ fontSize: 12, color: TEXT_SECONDARY, display: "block", marginBottom: 6 }}>Frequency</span>
                <select
                  value={formFrequency}
                  onChange={(e) => { setFormFrequency(e.target.value); setFormScheduledDay(null) }}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: `1px solid ${CARD_BORDER}`,
                    background: "#0A0C10",
                    color: TEXT_PRIMARY,
                    fontSize: 13,
                    outline: "none",
                  }}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Bi-weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </label>
            )}

            {/* Schedule — Day picker for weekly/biweekly */}
            {formType === "recurring" && (formFrequency === "weekly" || formFrequency === "biweekly") && (
              <div style={{ marginBottom: 16 }}>
                <span style={{ fontSize: 12, color: TEXT_SECONDARY, display: "block", marginBottom: 6 }}>Day of the week</span>
                <div className="flex gap-1" style={{ flexWrap: "wrap" }}>
                  {[
                    { value: "monday", label: "Mon" },
                    { value: "tuesday", label: "Tue" },
                    { value: "wednesday", label: "Wed" },
                    { value: "thursday", label: "Thu" },
                    { value: "friday", label: "Fri" },
                    { value: "saturday", label: "Sat" },
                    { value: "sunday", label: "Sun" },
                  ].map((d) => {
                    const sel = formScheduledDay === d.value
                    return (
                      <button
                        key={d.value}
                        type="button"
                        onClick={() => setFormScheduledDay(sel ? null : d.value)}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 6,
                          border: sel ? `1px solid ${ROSE_GOLD}` : `1px solid ${CARD_BORDER}`,
                          background: sel ? `${ROSE_GOLD}15` : "transparent",
                          color: sel ? ROSE_GOLD : TEXT_TERTIARY,
                          fontSize: 11,
                          fontWeight: sel ? 600 : 400,
                          cursor: "pointer",
                          transition: "all 0.15s",
                        }}
                      >
                        {d.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Schedule — Day of month picker for monthly */}
            {formType === "recurring" && formFrequency === "monthly" && (
              <div style={{ marginBottom: 16 }}>
                <span style={{ fontSize: 12, color: TEXT_SECONDARY, display: "block", marginBottom: 6 }}>Day of the month</span>
                <select
                  value={formScheduledDay || ""}
                  onChange={(e) => setFormScheduledDay(e.target.value || null)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: `1px solid ${CARD_BORDER}`,
                    background: "#0A0C10",
                    color: TEXT_PRIMARY,
                    fontSize: 13,
                    outline: "none",
                  }}
                >
                  <option value="">Select day...</option>
                  {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={String(d)}>{d}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Schedule — Time picker for all recurring */}
            {formType === "recurring" && (
              <div style={{ marginBottom: 16 }}>
                <span style={{ fontSize: 12, color: TEXT_SECONDARY, display: "block", marginBottom: 6 }}>Time</span>
                <div className="flex gap-2 items-center">
                  <select
                    value={formScheduledTime.split(":")[0]}
                    onChange={(e) => setFormScheduledTime(`${e.target.value}:${formScheduledTime.split(":")[1]}`)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: `1px solid ${CARD_BORDER}`,
                      background: "#0A0C10",
                      color: TEXT_PRIMARY,
                      fontSize: 13,
                      outline: "none",
                      width: 80,
                    }}
                  >
                    {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0")).map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                  <span style={{ color: TEXT_TERTIARY, fontSize: 14 }}>:</span>
                  <select
                    value={formScheduledTime.split(":")[1]}
                    onChange={(e) => setFormScheduledTime(`${formScheduledTime.split(":")[0]}:${e.target.value}`)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: `1px solid ${CARD_BORDER}`,
                      background: "#0A0C10",
                      color: TEXT_PRIMARY,
                      fontSize: 13,
                      outline: "none",
                      width: 80,
                    }}
                  >
                    {["00", "15", "30", "45"].map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Schedule summary line */}
            {formType === "recurring" && (
              <div style={{
                marginBottom: 16,
                padding: "8px 12px",
                borderRadius: 8,
                background: "rgba(129,140,248,0.08)",
                border: "1px solid rgba(129,140,248,0.15)",
              }}>
                <span style={{ fontSize: 12, color: "#818CF8" }}>
                  {(() => {
                    const time = formScheduledTime || "09:00"
                    if (formFrequency === "daily") return `Runs daily at ${time}`
                    if (formFrequency === "weekly")
                      return formScheduledDay
                        ? `Runs every ${formScheduledDay.charAt(0).toUpperCase() + formScheduledDay.slice(1)} at ${time}`
                        : `Runs every week at ${time}`
                    if (formFrequency === "biweekly")
                      return formScheduledDay
                        ? `Runs every other ${formScheduledDay.charAt(0).toUpperCase() + formScheduledDay.slice(1)} at ${time}`
                        : `Runs every 2 weeks at ${time}`
                    if (formFrequency === "monthly")
                      return formScheduledDay
                        ? `Runs on the ${formScheduledDay}${["1","21"].includes(formScheduledDay) ? "st" : ["2","22"].includes(formScheduledDay) ? "nd" : ["3","23"].includes(formScheduledDay) ? "rd" : "th"} of each month at ${time}`
                        : `Runs monthly at ${time}`
                    return `Runs ${formFrequency} at ${time}`
                  })()}
                </span>
              </div>
            )}

            {/* Submit */}
            <button
              onClick={createResearch}
              disabled={creating || !formTitle.trim()}
              style={{
                width: "100%",
                padding: "10px 0",
                borderRadius: 8,
                border: "none",
                background: `linear-gradient(135deg, ${ROSE_GOLD}, #D4A5A2)`,
                color: VOID,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                opacity: creating || !formTitle.trim() ? 0.5 : 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              {creating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {creating ? "Launching..." : "Launch Research"}
            </button>
          </div>
        </div>
      )}

      {/* Conference Accept Modal */}
      {showConferenceModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            backdropFilter: "blur(8px)",
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() => setShowConferenceModal(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 420,
              background: "rgba(15,17,24,0.6)",
              border: `1px solid ${CARD_BORDER}`,
              borderRadius: 14,
              padding: 28,
            }}
          >
            <h3 style={{ fontFamily: "'Bellfair', serif", fontSize: 18, color: TEXT_PRIMARY, margin: "0 0 16px" }}>
              Accept Conference
            </h3>
            <p style={{ fontSize: 13, color: TEXT_SECONDARY, marginBottom: 16 }}>Who is attending?</p>

            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
              {employees.map((emp) => {
                const selected = conferenceAttendees.split(",").map((s) => s.trim()).includes(emp.email || emp.name)
                return (
                  <button
                    key={emp.id}
                    onClick={() => {
                      const val = emp.email || emp.name
                      const list = conferenceAttendees.split(",").map((s) => s.trim()).filter(Boolean)
                      if (selected) {
                        setConferenceAttendees(list.filter((x) => x !== val).join(", "))
                      } else {
                        setConferenceAttendees([...list, val].join(", "))
                      }
                    }}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 6,
                      border: selected ? `1px solid #22C55E` : `1px solid ${CARD_BORDER}`,
                      background: selected ? "rgba(34,197,94,0.1)" : "transparent",
                      color: selected ? "#22C55E" : TEXT_SECONDARY,
                      fontSize: 12,
                      cursor: "pointer",
                      textAlign: "left",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Users size={12} />
                    {emp.name}
                  </button>
                )
              })}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowConferenceModal(null)}
                style={{
                  flex: 1,
                  padding: "8px 0",
                  borderRadius: 8,
                  border: `1px solid ${CARD_BORDER}`,
                  background: "transparent",
                  color: TEXT_SECONDARY,
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => acceptConference(showConferenceModal)}
                style={{
                  flex: 1,
                  padding: "8px 0",
                  borderRadius: 8,
                  border: "none",
                  background: "rgba(34,197,94,0.2)",
                  color: "#22C55E",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                ✅ Confirm & Add to Calendar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pulse animation */}
      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.3); }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
