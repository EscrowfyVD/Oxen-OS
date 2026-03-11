"use client"

import { usePathname } from "next/navigation"
import Sidebar from "./Sidebar"

export default function SidebarLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  // Don't show sidebar on login page
  if (pathname === "/login") {
    return <>{children}</>
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
