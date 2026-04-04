/* ── SEO / GEO — Canonical Configuration ── */

// ─── Verticals with brand colors ───
export const SEO_VERTICALS = [
  { id: "fintech_crypto", label: "FinTech / Crypto", color: "#818CF8" },
  { id: "family_office", label: "Family Office", color: "#C08B88" },
  { id: "csp_fiduciaries", label: "CSP / Fiduciaries", color: "#FBBF24" },
  { id: "luxury_assets", label: "Luxury Assets", color: "#A78BFA" },
  { id: "igaming", label: "iGaming", color: "#34D399" },
  { id: "yacht_brokers", label: "Yacht Brokers", color: "#22D3EE" },
  { id: "import_export", label: "Import / Export", color: "#60A5FA" },
] as const

export type SeoVerticalId = (typeof SEO_VERTICALS)[number]["id"]

// ─── Vertical color map (id → color) ───
export const VERTICAL_COLORS: Record<string, string> = Object.fromEntries(
  SEO_VERTICALS.map((v) => [v.id, v.color]),
)

// ─── Helper: get color by vertical label ───
export function getVerticalColor(vertical: string): string {
  const found = SEO_VERTICALS.find((v) => v.label === vertical)
  return found?.color ?? "#818CF8"
}

// ─── Seed Keywords ───
export const SEED_KEYWORDS: { keyword: string; vertical: string }[] = [
  // FinTech / Crypto
  { keyword: "corporate account crypto company", vertical: "FinTech / Crypto" },
  { keyword: "business banking blockchain", vertical: "FinTech / Crypto" },
  { keyword: "payment solution cryptocurrency", vertical: "FinTech / Crypto" },
  { keyword: "financial services digital assets", vertical: "FinTech / Crypto" },
  { keyword: "crypto company bank account Europe", vertical: "FinTech / Crypto" },
  { keyword: "VASP banking", vertical: "FinTech / Crypto" },
  { keyword: "MiCA compliant financial services", vertical: "FinTech / Crypto" },
  { keyword: "fiat on-ramp off-ramp provider", vertical: "FinTech / Crypto" },

  // Family Office
  { keyword: "family office banking services", vertical: "Family Office" },
  { keyword: "international account family office", vertical: "Family Office" },
  { keyword: "wealth structuring Monaco", vertical: "Family Office" },
  { keyword: "multi-family office financial partner", vertical: "Family Office" },
  { keyword: "UHNW banking Europe", vertical: "Family Office" },

  // CSP / Fiduciaries
  { keyword: "corporate services provider banking", vertical: "CSP / Fiduciaries" },
  { keyword: "fiduciary account Malta", vertical: "CSP / Fiduciaries" },
  { keyword: "trust company banking partner", vertical: "CSP / Fiduciaries" },
  { keyword: "CSP financial services", vertical: "CSP / Fiduciaries" },

  // iGaming
  { keyword: "payment provider igaming", vertical: "iGaming" },
  { keyword: "business account online gaming", vertical: "iGaming" },
  { keyword: "igaming banking Europe", vertical: "iGaming" },
  { keyword: "gambling company financial services", vertical: "iGaming" },
  { keyword: "igaming payment processing Malta", vertical: "iGaming" },

  // Luxury Assets
  { keyword: "yacht transaction banking", vertical: "Luxury Assets" },
  { keyword: "luxury asset financing", vertical: "Luxury Assets" },
  { keyword: "superyacht payment services", vertical: "Luxury Assets" },
  { keyword: "high-value transaction provider", vertical: "Luxury Assets" },

  // Yacht Brokers
  { keyword: "yacht broker payment services", vertical: "Yacht Brokers" },
  { keyword: "international payments yacht purchase", vertical: "Yacht Brokers" },
  { keyword: "superyacht transaction management", vertical: "Yacht Brokers" },

  // Import / Export
  { keyword: "international trade banking", vertical: "Import / Export" },
  { keyword: "import export payment services", vertical: "Import / Export" },
  { keyword: "cross-border payment business", vertical: "Import / Export" },
  { keyword: "commodity trading banking", vertical: "Import / Export" },
]

// ─── Seed News Sources ───
export const SEED_NEWS_SOURCES: {
  name: string
  url: string
  rssUrl: string | null
  category: string
}[] = [
  // Crypto
  { name: "CoinDesk", url: "https://coindesk.com", rssUrl: "https://www.coindesk.com/arc/outboundfeeds/rss/", category: "Crypto" },
  { name: "The Block", url: "https://theblock.co", rssUrl: null, category: "Crypto" },
  { name: "Cointelegraph", url: "https://cointelegraph.com", rssUrl: "https://cointelegraph.com/rss", category: "Crypto" },
  { name: "Decrypt", url: "https://decrypt.co", rssUrl: null, category: "Crypto" },
  { name: "CryptoSlate", url: "https://cryptoslate.com", rssUrl: null, category: "Crypto" },
  { name: "Blockworks", url: "https://blockworks.co", rssUrl: null, category: "Crypto" },

  // Fintech
  { name: "Finextra", url: "https://finextra.com", rssUrl: "https://www.finextra.com/rss/headlines.aspx", category: "Fintech" },
  { name: "PaymentsJournal", url: "https://paymentsjournal.com", rssUrl: null, category: "Fintech" },
  { name: "PYMNTS", url: "https://pymnts.com", rssUrl: "https://www.pymnts.com/feed/", category: "Fintech" },
  { name: "The Fintech Times", url: "https://thefintechtimes.com", rssUrl: null, category: "Fintech" },
  { name: "Sifted", url: "https://sifted.eu", rssUrl: "https://sifted.eu/feed", category: "Fintech" },

  // Regulatory
  { name: "Reuters Legal", url: "https://reuters.com/legal", rssUrl: null, category: "Regulatory" },
  { name: "EBA", url: "https://eba.europa.eu", rssUrl: null, category: "Regulatory" },
  { name: "FATF", url: "https://fatf-gafi.org", rssUrl: null, category: "Regulatory" },

  // Luxury
  { name: "Robb Report", url: "https://robbreport.com", rssUrl: null, category: "Luxury" },
  { name: "Superyacht News", url: "https://superyachtnews.com", rssUrl: null, category: "Luxury" },
  { name: "Family Capital", url: "https://familycapital.com", rssUrl: null, category: "Luxury" },
  { name: "Spear's Magazine", url: "https://spearswms.com", rssUrl: null, category: "Luxury" },
]

// ─── Seed GEO Prompts ───
export const SEED_GEO_PROMPTS: { prompt: string; vertical: string }[] = [
  // FinTech / Crypto
  { prompt: "What are the best financial service providers for crypto companies in Europe?", vertical: "FinTech / Crypto" },
  { prompt: "How can a blockchain startup open a business bank account?", vertical: "FinTech / Crypto" },
  { prompt: "Which EMIs accept crypto companies as clients?", vertical: "FinTech / Crypto" },
  { prompt: "What is MiCA and how does it affect crypto banking?", vertical: "FinTech / Crypto" },
  { prompt: "Best payment processors for digital asset businesses", vertical: "FinTech / Crypto" },
  { prompt: "How to get a corporate bank account for a crypto exchange", vertical: "FinTech / Crypto" },
  { prompt: "Financial institutions that serve Web3 companies", vertical: "FinTech / Crypto" },
  { prompt: "Best banking partners for crypto startups in Europe", vertical: "FinTech / Crypto" },
  { prompt: "VASP compliance and banking requirements", vertical: "FinTech / Crypto" },
  { prompt: "Fiat on-ramp and off-ramp services for crypto businesses", vertical: "FinTech / Crypto" },

  // Family Office
  { prompt: "How do family offices structure international banking?", vertical: "Family Office" },
  { prompt: "Best banking partners for multi-family offices in Europe", vertical: "Family Office" },
  { prompt: "International account solutions for UHNW individuals", vertical: "Family Office" },
  { prompt: "Family office financial services providers Europe", vertical: "Family Office" },
  { prompt: "Wealth management banking for family offices", vertical: "Family Office" },
  { prompt: "Multi-currency account solutions for family offices", vertical: "Family Office" },
  { prompt: "Best jurisdictions for family office banking", vertical: "Family Office" },
  { prompt: "Family office payment and treasury management", vertical: "Family Office" },
  { prompt: "Private banking alternatives for family offices", vertical: "Family Office" },
  { prompt: "How do family offices manage cross-border payments?", vertical: "Family Office" },

  // CSP / Fiduciaries
  { prompt: "Banking solutions for corporate service providers in Malta", vertical: "CSP / Fiduciaries" },
  { prompt: "Which financial institutions work with fiduciaries?", vertical: "CSP / Fiduciaries" },
  { prompt: "Best banking partners for trust companies", vertical: "CSP / Fiduciaries" },
  { prompt: "CSP payment solutions Europe", vertical: "CSP / Fiduciaries" },
  { prompt: "Fiduciary account management services", vertical: "CSP / Fiduciaries" },
  { prompt: "Corporate service provider financial infrastructure", vertical: "CSP / Fiduciaries" },
  { prompt: "Trust company banking requirements", vertical: "CSP / Fiduciaries" },
  { prompt: "Professional trustee banking services", vertical: "CSP / Fiduciaries" },
  { prompt: "Client money account solutions for CSPs", vertical: "CSP / Fiduciaries" },
  { prompt: "Fiduciary compliance banking partners", vertical: "CSP / Fiduciaries" },

  // iGaming
  { prompt: "Payment providers for iGaming companies in Malta", vertical: "iGaming" },
  { prompt: "How to open a business account for an online gaming company", vertical: "iGaming" },
  { prompt: "Banking solutions for gambling companies in Europe", vertical: "iGaming" },
  { prompt: "iGaming payment processing Malta", vertical: "iGaming" },
  { prompt: "Best EMIs for online gambling operators", vertical: "iGaming" },
  { prompt: "Payment gateway solutions for iGaming", vertical: "iGaming" },
  { prompt: "Regulated banking for gaming operators", vertical: "iGaming" },
  { prompt: "Casino operator banking services Europe", vertical: "iGaming" },
  { prompt: "iGaming merchant account providers", vertical: "iGaming" },
  { prompt: "Online gambling payment solutions", vertical: "iGaming" },

  // Luxury Assets
  { prompt: "Financial services for yacht transactions", vertical: "Luxury Assets" },
  { prompt: "How to handle international payments for luxury asset purchases", vertical: "Luxury Assets" },
  { prompt: "Luxury goods transaction banking services", vertical: "Luxury Assets" },
  { prompt: "High-value asset payment processing", vertical: "Luxury Assets" },
  { prompt: "Art and luxury collectibles financial services", vertical: "Luxury Assets" },
  { prompt: "Superyacht financing and payment services", vertical: "Luxury Assets" },
  { prompt: "Luxury real estate transaction management", vertical: "Luxury Assets" },
  { prompt: "High-net-worth asset purchase banking", vertical: "Luxury Assets" },
  { prompt: "Escrow services for luxury asset sales", vertical: "Luxury Assets" },
  { prompt: "International payment solutions for luxury dealers", vertical: "Luxury Assets" },

  // Yacht Brokers
  { prompt: "Yacht broker payment services Europe", vertical: "Yacht Brokers" },
  { prompt: "International payments for yacht purchases", vertical: "Yacht Brokers" },
  { prompt: "Superyacht transaction management financial services", vertical: "Yacht Brokers" },
  { prompt: "Yacht sale escrow and payment processing", vertical: "Yacht Brokers" },
  { prompt: "Marine industry banking solutions", vertical: "Yacht Brokers" },
  { prompt: "Yacht brokerage financial services", vertical: "Yacht Brokers" },
  { prompt: "Cross-border yacht purchase payments", vertical: "Yacht Brokers" },
  { prompt: "Yacht charter company banking", vertical: "Yacht Brokers" },
  { prompt: "Superyacht industry financial partners", vertical: "Yacht Brokers" },
  { prompt: "How to process large yacht transactions safely", vertical: "Yacht Brokers" },

  // Import / Export
  { prompt: "International trade banking solutions", vertical: "Import / Export" },
  { prompt: "Import export payment services Europe", vertical: "Import / Export" },
  { prompt: "Cross-border payment business accounts", vertical: "Import / Export" },
  { prompt: "Commodity trading banking partners", vertical: "Import / Export" },
  { prompt: "Trade finance solutions for SMEs", vertical: "Import / Export" },
  { prompt: "International trade payment processing", vertical: "Import / Export" },
  { prompt: "Export finance and banking services", vertical: "Import / Export" },
  { prompt: "Letter of credit banking partners", vertical: "Import / Export" },
  { prompt: "Multi-currency accounts for importers", vertical: "Import / Export" },
  { prompt: "Best banks for international trade companies", vertical: "Import / Export" },
]

// ─── Article Statuses ───
export const ARTICLE_STATUSES = [
  { id: "queued", label: "Queued", color: "rgba(240,240,242,0.3)" },
  { id: "draft", label: "Draft", color: "#FBBF24" },
  { id: "in_review", label: "In Review", color: "#60A5FA" },
  { id: "published", label: "Published", color: "#34D399" },
  { id: "decaying", label: "Decaying", color: "#F87171" },
  { id: "archived", label: "Archived", color: "rgba(240,240,242,0.2)" },
] as const

// ─── Alert Severity ───
export const ALERT_SEVERITY: Record<string, { color: string; bg: string; label: string }> = {
  critical: { color: "#F87171", bg: "rgba(248,113,113,0.12)", label: "Critical" },
  warning: { color: "#FBBF24", bg: "rgba(251,191,36,0.12)", label: "Warning" },
  info: { color: "#60A5FA", bg: "rgba(96,165,250,0.12)", label: "Info" },
}

// ─── Oxen Context (for AI prompts) ───
export const OXEN_CONTEXT = `Oxen Financial Services is a European EMI (Electronic Money Institution) headquartered in Malta. We provide business banking, payment processing, and financial services to companies in regulated and high-risk verticals including FinTech/Crypto, iGaming, Family Offices, CSPs/Fiduciaries, Luxury Assets, Yacht Brokers, and Import/Export businesses. Our core value proposition is serving industries that traditional banks avoid, with full regulatory compliance (MiCA, MGA, MFSA). We offer multi-currency IBANs, FX, SEPA/SWIFT transfers, and dedicated account management.`
