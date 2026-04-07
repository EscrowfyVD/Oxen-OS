import type { Metadata } from "next"
import "./globals.css"
import SessionProvider from "@/components/layout/SessionProvider"
import SidebarLayout from "@/components/layout/SidebarLayout"
import CommandPaletteProvider from "@/components/crm/CommandPaletteProvider"
import { ThemeProvider } from "@/lib/theme"

export const metadata: Metadata = {
  title: "Oxen OS",
  description: "Internal Dashboard — Oxen Finance",
}

// Inline script to apply theme before React hydrates (prevents flash)
const themeScript = `
try {
  var t = localStorage.getItem('oxen_theme') || 'dark';
  var r = t === 'system' ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : t;
  document.documentElement.classList.add(r);
  document.documentElement.style.colorScheme = r;
} catch(e) {}
`

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <ThemeProvider>
          <SessionProvider>
            <CommandPaletteProvider>
              <SidebarLayout>{children}</SidebarLayout>
            </CommandPaletteProvider>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
