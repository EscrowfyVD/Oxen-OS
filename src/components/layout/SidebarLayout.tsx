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
        style={{ background: "var(--bg)", minHeight: "100vh" }}
      >
        <div
          className="text-sm"
          style={{ color: "var(--text-dim)" }}
        >
          Loading...
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main
        className="flex-1 md:ml-[260px] p-6 md:p-8"
        style={{ background: "var(--bg)", minHeight: "100vh" }}
      >
        {children}
      </main>
    </div>
  )
}
