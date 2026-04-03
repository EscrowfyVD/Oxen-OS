import type { Metadata } from "next"
import "./globals.css"
import SessionProvider from "@/components/layout/SessionProvider"
import SidebarLayout from "@/components/layout/SidebarLayout"
import CommandPaletteProvider from "@/components/crm/CommandPaletteProvider"

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
          <CommandPaletteProvider>
            <SidebarLayout>{children}</SidebarLayout>
          </CommandPaletteProvider>
        </SessionProvider>
      </body>
    </html>
  )
}
