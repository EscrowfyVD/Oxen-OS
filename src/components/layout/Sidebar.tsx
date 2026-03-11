"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { useState } from "react"

const navItems = [
  { label: "Dashboard", href: "/", icon: "\u25C6", badge: null, count: null },
  { label: "Tasks", href: "/tasks", icon: "\u2610", badge: null, count: 12 },
  { label: "Calendar", href: "/calendar", icon: "\u25F7", badge: null, count: null },
  { label: "Wiki", href: "/wiki", icon: "\u2630", badge: null, count: null },
  { label: "Organigramme", href: "/org", icon: "\u2B21", badge: null, count: null },
  { label: "Team", href: "/team", icon: "\u2687", badge: null, count: null },
  { label: "CRM", href: "/crm", icon: "\u25CE", badge: null, count: null },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [mobileOpen, setMobileOpen] = useState(false)

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
          background: "linear-gradient(180deg, var(--subtle-dark) 0%, var(--void) 100%)",
          borderRight: "1px solid var(--card-border)",
          transition: "transform 0.3s cubic-bezier(0.4,0,0.2,1)",
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
            <div
              className="flex items-center justify-center"
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "var(--logo-gradient)",
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  fontFamily: "'Bellfair', serif",
                  fontSize: 18,
                  color: "var(--void)",
                  fontWeight: 400,
                  lineHeight: 1,
                }}
              >
                O
              </span>
            </div>
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
          {navItems.map((item) => {
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`nav-item${active ? " active" : ""}`}
                style={{
                  textDecoration: "none",
                }}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="flex-1">{item.label}</span>
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
            )
          })}
        </nav>

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
                  background: "linear-gradient(135deg, #C08B88, #8B6B68)",
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#FFFFFF",
                    lineHeight: 1,
                  }}
                >
                  {userInitials}
                </span>
              </div>
              <div className="min-w-0">
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
                <div
                  style={{
                    fontSize: 10,
                    color: "var(--text-tertiary)",
                    lineHeight: 1.3,
                  }}
                >
                  CEO
                </div>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  )
}
