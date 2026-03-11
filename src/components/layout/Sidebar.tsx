"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut, useSession } from "next-auth/react"
import { useState } from "react"

const navItems = [
  { label: "Dashboard", href: "/", icon: "📊", badge: null },
  { label: "Calendar", href: "/calendar", icon: "📅", badge: null },
  { label: "Wiki", href: "/wiki", icon: "📝", badge: null },
  { label: "Organigramme", href: "/org", icon: "👥", badge: null },
  { label: "CRM", href: "/crm", icon: "🔄", badge: "Soon" },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [mobileOpen, setMobileOpen] = useState(false)

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/"
    return pathname.startsWith(href)
  }

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed top-4 left-4 z-50 md:hidden"
        style={{
          padding: "8px 10px",
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          cursor: "pointer",
        }}
      >
        <span style={{ color: "var(--text)", fontSize: 18 }}>
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
          width: 260,
          background: "var(--bg-elevated)",
          borderRight: "1px solid var(--border)",
          transition: "transform 0.3s cubic-bezier(0.4,0,0.2,1)",
        }}
      >
        {/* Brand */}
        <div
          style={{
            padding: "20px 22px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center font-bold"
              style={{
                width: 38,
                height: 38,
                borderRadius: 9,
                background: "linear-gradient(135deg, #C08B88, #D4A5A2)",
                color: "#0F1419",
                fontSize: 18,
              }}
            >
              O
            </div>
            <div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "var(--text)",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                Oxen OS
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--text-dim)",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                Internal Dashboard
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto" style={{ padding: "12px 10px" }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.1em",
              color: "var(--text-dim)",
              padding: "8px 14px 6px",
            }}
          >
            NAVIGATION
          </div>

          {navItems.map((item) => {
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 no-underline"
                style={{
                  padding: "9px 14px",
                  marginBottom: 2,
                  borderRadius: active ? "0 8px 8px 0" : 8,
                  fontSize: 13,
                  fontFamily: "'DM Sans', sans-serif",
                  fontWeight: active ? 500 : 400,
                  color: active ? "var(--rose)" : "var(--text-mid)",
                  background: active ? "rgba(192,139,136,0.12)" : "transparent",
                  borderLeft: active ? "3px solid var(--rose)" : "3px solid transparent",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = "rgba(255,255,255,0.04)"
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = "transparent"
                  }
                }}
              >
                <span style={{ fontSize: 15 }}>{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                {item.badge && (
                  <span
                    style={{
                      fontSize: 10,
                      padding: "2px 8px",
                      borderRadius: 999,
                      background: "rgba(255,255,255,0.06)",
                      color: "var(--text-dim)",
                      fontWeight: 500,
                    }}
                  >
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
              padding: "16px 18px",
              borderTop: "1px solid var(--border)",
            }}
          >
            <div className="flex items-center gap-3">
              {session.user.image ? (
                <img
                  src={session.user.image}
                  alt=""
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    border: "2px solid var(--border)",
                  }}
                />
              ) : (
                <div
                  className="flex items-center justify-center"
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: "var(--rose-dim)",
                    color: "var(--rose)",
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {session.user.name?.[0] ?? "?"}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div
                  className="truncate"
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: "var(--text)",
                  }}
                >
                  {session.user.name}
                </div>
                <button
                  onClick={() => signOut()}
                  style={{
                    fontSize: 11,
                    color: "var(--text-dim)",
                    background: "none",
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                    fontFamily: "'DM Sans', sans-serif",
                    transition: "color 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "var(--rose)"
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "var(--text-dim)"
                  }}
                >
                  Sign out
                </button>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  )
}
