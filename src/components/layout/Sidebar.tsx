"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut, useSession } from "next-auth/react"
import { useState } from "react"

const navItems = [
  { label: "Dashboard", href: "/", icon: "📋", section: "MAIN" },
  { label: "Calendar", href: "/calendar", icon: "📅", section: "MAIN" },
  { label: "Wiki", href: "/wiki", icon: "📝", section: "MAIN" },
  { label: "Organigramme", href: "/org", icon: "👥", section: "MAIN" },
  { label: "CRM", href: "/crm", icon: "🔄", section: "COMING SOON" },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [mobileOpen, setMobileOpen] = useState(false)

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/"
    return pathname.startsWith(href)
  }

  const mainItems = navItems.filter((item) => item.section === "MAIN")
  const comingSoonItems = navItems.filter((item) => item.section === "COMING SOON")

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed top-4 left-4 z-50 md:hidden p-2 rounded-lg"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
      >
        <span style={{ color: "var(--text)", fontSize: 20 }}>{mobileOpen ? "✕" : "☰"}</span>
      </button>

      {/* Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full z-40 flex flex-col transition-transform duration-200 md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{
          width: 260,
          background: "var(--bg-elevated)",
          borderRight: "1px solid var(--border)",
        }}
      >
        {/* Brand */}
        <div className="p-5 pb-3">
          <div className="flex items-center gap-3 mb-1">
            <div
              className="flex items-center justify-center font-bold text-lg"
              style={{
                width: 38,
                height: 38,
                borderRadius: 9,
                background: "linear-gradient(135deg, #C08B88, #D4A5A2)",
                color: "#0F1419",
              }}
            >
              O
            </div>
            <div>
              <div className="font-semibold text-sm" style={{ color: "var(--text)" }}>
                Oxen OS
              </div>
              <div className="text-xs" style={{ color: "var(--text-dim)" }}>
                Internal Dashboard
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 overflow-y-auto">
          <div
            className="text-[10px] font-semibold tracking-widest px-3 py-2 mt-2"
            style={{ color: "var(--text-dim)" }}
          >
            MAIN
          </div>
          {mainItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 text-sm transition-all duration-150 no-underline"
              style={{
                background: isActive(item.href) ? "var(--rose-dim)" : "transparent",
                color: isActive(item.href) ? "var(--rose-light)" : "var(--text-mid)",
                borderLeft: isActive(item.href) ? "3px solid var(--rose)" : "3px solid transparent",
              }}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}

          <div
            className="text-[10px] font-semibold tracking-widest px-3 py-2 mt-4"
            style={{ color: "var(--text-dim)" }}
          >
            COMING SOON
          </div>
          {comingSoonItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 text-sm no-underline opacity-50 cursor-default"
              style={{
                color: "var(--text-dim)",
                borderLeft: "3px solid transparent",
              }}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* User */}
        {session?.user && (
          <div
            className="p-4"
            style={{ borderTop: "1px solid var(--border)" }}
          >
            <div className="flex items-center gap-3">
              {session.user.image ? (
                <img
                  src={session.user.image}
                  alt=""
                  className="rounded-full"
                  style={{ width: 32, height: 32 }}
                />
              ) : (
                <div
                  className="rounded-full flex items-center justify-center text-xs font-bold"
                  style={{
                    width: 32,
                    height: 32,
                    background: "var(--rose-dim)",
                    color: "var(--rose)",
                  }}
                >
                  {session.user.name?.[0] ?? "?"}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate" style={{ color: "var(--text)" }}>
                  {session.user.name}
                </div>
                <button
                  onClick={() => signOut()}
                  className="text-xs hover:underline cursor-pointer bg-transparent border-none p-0"
                  style={{ color: "var(--text-dim)" }}
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
