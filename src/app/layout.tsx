import type { Metadata } from "next"
import "./globals.css"
import SessionProvider from "@/components/layout/SessionProvider"
import SidebarLayout from "@/components/layout/SidebarLayout"

export const metadata: Metadata = {
  title: "Oxen OS",
  description: "Internal Dashboard — Oxen Finance",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>
        <SessionProvider>
          <SidebarLayout>{children}</SidebarLayout>
        </SessionProvider>
      </body>
    </html>
  )
}
