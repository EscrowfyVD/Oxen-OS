"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { useState, useEffect } from "react"
import {
  LayoutDashboard,
  Shield,
  ShieldCheck,
  CheckSquare,
  CalendarDays,
  BookOpen,
  Building2,
  Users,
  Palmtree,
  Wallet,
  Megaphone,
  Headphones,
  Handshake,
  Search,
  Tent,
  Settings,
  LogOut,
  type LucideIcon,
} from "lucide-react"
import { Sun, Moon, Monitor } from "lucide-react"
import { ROLE_COLORS, ROLE_LABELS, canAccess, canAccessPage, type RoleLevel } from "@/lib/permissions"
import { getAvatarGradient } from "@/lib/avatar"
import { useTheme } from "@/lib/theme"

type NavItem = {
  label: string
  href: string
  icon: LucideIcon
  badge: string | null
  count: number | null
  pageKey?: string
  section?: "main" | "internal"
}

const NAV_ITEMS: NavItem[] = [
  // ── MAIN ──
  { label: "Dashboard", href: "/", icon: LayoutDashboard, badge: null, count: null },
  { label: "Sentinel", href: "/ai", icon: Shield, badge: null, count: null },
  { label: "Tasks", href: "/tasks", icon: CheckSquare, badge: null, count: 12 },
  { label: "Calendar", href: "/calendar", icon: CalendarDays, badge: null, count: null },
  { label: "CRM", href: "/crm", icon: Handshake, badge: null, count: null, pageKey: "crm" },
  { label: "Marketing", href: "/marketing", icon: Megaphone, badge: null, count: null, pageKey: "marketing" },
  { label: "Intel", href: "/intel", icon: Search, badge: null, count: null },
  { label: "Conferences", href: "/conferences", icon: Tent, badge: null, count: null },
  { label: "Finance", href: "/finance", icon: Wallet, badge: null, count: null, pageKey: "finance" },
  { label: "Compliance", href: "/compliance", icon: ShieldCheck, badge: null, count: null, pageKey: "compliance" },
  { label: "Support", href: "/support", icon: Headphones, badge: null, count: null },
  // ── INTERNAL ──
  { label: "Organigramme", href: "/org", icon: Building2, badge: null, count: null, section: "internal" },
  { label: "Team", href: "/team", icon: Users, badge: null, count: null, section: "internal" },
  { label: "Wiki", href: "/wiki", icon: BookOpen, badge: null, count: null, section: "internal" },
  { label: "Absences", href: "/absences", icon: Palmtree, badge: null, count: null, section: "internal" },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const { theme, resolvedTheme, setTheme } = useTheme()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [wikiCount, setWikiCount] = useState<number | null>(null)
  const [userRole, setUserRole] = useState<RoleLevel>("member")
  const [userDepartment, setUserDepartment] = useState<string | null>(null)
  const [userJobTitle, setUserJobTitle] = useState<string | null>(null)
  const [signOutHover, setSignOutHover] = useState(false)
  const [userAvatarColor, setUserAvatarColor] = useState<string | null>(null)
  const [userIcon, setUserIcon] = useState<string | null>(null)
  const [userInitialsFromApi, setUserInitialsFromApi] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/wiki?limit=1")
      .then((r) => r.json())
      .then((data) => { if (data.total != null) setWikiCount(data.total) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!session?.user?.email) return
    fetch("/api/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.employee) {
          setUserRole((data.employee.roleLevel ?? "member") as RoleLevel)
          setUserDepartment(data.employee.department ?? null)
          setUserJobTitle(data.employee.role ?? null)
          setUserAvatarColor(data.employee.avatarColor ?? null)
          setUserIcon(data.employee.icon ?? null)
          setUserInitialsFromApi(data.employee.initials ?? null)
        }
      })
      .catch(() => {})
  }, [session?.user?.email])

  const navItems = NAV_ITEMS
    .filter((item) => {
      if (item.pageKey && !canAccessPage(userRole, userDepartment, item.pageKey)) return false
      return true
    })
    .map((item) =>
      item.label === "Wiki" && wikiCount !== null
        ? { ...item, count: wikiCount }
        : item
    )

  // Settings visible for admin+
  const showSettings = canAccess(userRole, "admin")

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/"
    return pathname.startsWith(href)
  }

  const userInitials = session?.user?.name
    ? session.user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?"

  const roleStyle = ROLE_COLORS[userRole]

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed top-4 left-4 z-50 md:hidden"
        style={{
          padding: "8px 10px",
          background: "var(--card-bg)",
          border: "1px solid var(--card-border)",
          borderRadius: 10,
          cursor: "pointer",
        }}
      >
        <span style={{ color: "var(--text-primary)", fontSize: 18 }}>
          {mobileOpen ? "\u2715" : "\u2630"}
        </span>
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full z-40 flex flex-col md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{
          width: 220,
          background: "var(--sidebar-bg)",
          borderRight: "1px solid var(--sidebar-border)",
          transition: "transform 0.3s cubic-bezier(0.4,0,0.2,1), background 0.3s ease",
          padding: "28px 0",
        }}
      >
        {/* Brand / Logo */}
        <div
          style={{
            padding: "0 24px 28px",
          }}
        >
          <div className="flex items-center gap-3">
            <img
              src="/oxen-logo.svg"
              alt="Oxen"
              style={{
                width: 32,
                height: 32,
                objectFit: "contain",
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontFamily: "'Bellfair', serif",
                fontSize: 22,
                letterSpacing: "3px",
                background: "var(--logo-gradient)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                lineHeight: 1,
              }}
            >
              OXEN
            </span>
          </div>
        </div>

        {/* Nav section label */}
        <div
          className="nav-section-label"
        >
          Navigation
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto" style={{ padding: 0 }}>
          {navItems.map((item, index) => {
            const active = isActive(item.href)
            const isFirstInternal =
              item.section === "internal" &&
              (index === 0 || navItems[index - 1].section !== "internal")
            return (
              <div key={item.href}>
                {isFirstInternal && (
                  <div className="nav-section-label">
                    Internal
                  </div>
                )}
                <Link
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`nav-item${active ? " active" : ""}${item.label === "Sentinel" ? " ai-agent-nav" : ""}`}
                  style={{
                    textDecoration: "none",
                  }}
                >
                  <span className={`nav-icon${item.label === "Sentinel" ? " ai-pulse" : ""}`}>
                    <item.icon size={16} strokeWidth={1.8} />
                  </span>
                  <span className="flex-1" style={item.label === "Sentinel" ? { background: "linear-gradient(90deg, #C08B88, #E8C4C0)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" } : undefined}>{item.label}</span>
                  {item.count !== null && (
                    <span
                      style={{
                        marginLeft: "auto",
                        fontSize: 10,
                        color: "var(--text-tertiary)",
                      }}
                    >
                      {item.count}
                    </span>
                  )}
                  {item.badge && (
                    <span className="nav-badge">
                      {item.badge}
                    </span>
                  )}
                </Link>
              </div>
            )
          })}
        </nav>

        {/* Settings link (admin+) */}
        {showSettings && (
          <div style={{ padding: "0 0 4px" }}>
            <Link
              href="/settings"
              onClick={() => setMobileOpen(false)}
              className={`nav-item${isActive("/settings") ? " active" : ""}`}
              style={{ textDecoration: "none" }}
            >
              <span className="nav-icon">
                <Settings size={16} strokeWidth={1.8} />
              </span>
              <span className="flex-1">Settings</span>
            </Link>
          </div>
        )}

        {/* Footer / User */}
        {session?.user && (
          <div
            style={{
              padding: "16px 24px 0",
              borderTop: "1px solid var(--card-border)",
              paddingTop: 20,
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="flex items-center justify-center"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: getAvatarGradient(userAvatarColor),
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    fontSize: userIcon ? 14 : 11,
                    fontWeight: 600,
                    color: "#FFFFFF",
                    lineHeight: 1,
                  }}
                >
                  {userIcon || userInitialsFromApi || userInitials}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div
                  className="truncate"
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: "var(--text-primary)",
                    lineHeight: 1.3,
                  }}
                >
                  {session.user.name}
                </div>
                <div className="flex items-center gap-2" style={{ marginTop: 2 }}>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "1px 6px",
                      borderRadius: 4,
                      fontSize: 9,
                      fontWeight: 600,
                      letterSpacing: "0.3px",
                      lineHeight: "16px",
                      ...(roleStyle.gradient
                        ? { background: roleStyle.bg, color: roleStyle.text }
                        : { background: roleStyle.bg, color: roleStyle.text }
                      ),
                    }}
                  >
                    {ROLE_LABELS[userRole]}
                  </span>
                  {userJobTitle && (
                    <span
                      style={{
                        fontSize: 9,
                        color: "var(--text-tertiary)",
                        lineHeight: 1.3,
                      }}
                    >
                      {userJobTitle}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Theme toggle + Sign out */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14 }}>
              <div style={{ display: "flex", gap: 2, background: "var(--surface-subtle)", borderRadius: 8, padding: 2, border: "1px solid var(--card-border)" }}>
                {([
                  { value: "light" as const, Icon: Sun, label: "Light" },
                  { value: "dark" as const, Icon: Moon, label: "Dark" },
                  { value: "system" as const, Icon: Monitor, label: "System" },
                ] as const).map(({ value, Icon, label }) => (
                  <button
                    key={value}
                    onClick={() => setTheme(value)}
                    title={label}
                    style={{
                      padding: "4px 6px",
                      borderRadius: 6,
                      border: "none",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "all 0.2s ease",
                      background: theme === value ? "var(--rose-dim)" : "transparent",
                      color: theme === value ? "var(--rose-gold)" : "var(--text-tertiary)",
                    }}
                  >
                    <Icon size={12} strokeWidth={1.8} />
                  </button>
                ))}
              </div>

              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                onMouseEnter={() => setSignOutHover(true)}
                onMouseLeave={() => setSignOutHover(false)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  padding: 0,
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  fontSize: 11,
                  color: signOutHover ? "var(--rose-gold)" : "var(--text-tertiary)",
                  transition: "color 0.2s ease",
                }}
              >
                <LogOut size={13} strokeWidth={1.8} />
                Sign out
              </button>
            </div>
          </div>
        )}
      </aside>
    </>
  )
}
