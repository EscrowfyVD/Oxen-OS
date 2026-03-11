"use client"

import { usePathname, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import Sidebar from "./Sidebar"

export default function SidebarLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { status } = useSession()

  // Don't show sidebar on login page
  if (pathname === "/login") {
    return <>{children}</>
  }

  // Redirect to login if not authenticated
  if (status === "unauthenticated") {
    router.replace(`/login?callbackUrl=${encodeURIComponent(pathname)}`)
    return null
  }

  // Show nothing while loading session
  if (status === "loading") {
    return (
      <div
        className="flex items-center justify-center"
        style={{ background: "var(--void)", minHeight: "100vh" }}
      >
        <div
          className="text-sm"
          style={{ color: "var(--text-tertiary)" }}
        >
          Loading...
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--void)" }}>
      <Sidebar />
      <main
        className="main-content"
        style={{
          flex: 1,
          marginLeft: 220,
          background: "var(--void)",
          minHeight: "100vh",
          position: "relative",
          minWidth: 0,
        }}
      >
        <div className="accent-line" />
        {children}
      </main>
    </div>
  )
}
