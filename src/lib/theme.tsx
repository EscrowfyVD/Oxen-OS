"use client"

import { createContext, useContext, useState, useEffect, useCallback } from "react"

type Theme = "light" | "dark" | "system"
type ResolvedTheme = "light" | "dark"

interface ThemeContextType {
  theme: Theme
  resolvedTheme: ResolvedTheme
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "dark",
  resolvedTheme: "dark",
  setTheme: () => {},
})

export function useTheme() {
  return useContext(ThemeContext)
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "dark"
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"
}

function applyTheme(resolved: ResolvedTheme) {
  const el = document.documentElement
  el.classList.remove("light", "dark")
  el.classList.add(resolved)
  el.style.colorScheme = resolved
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark")
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("dark")
  const [mounted, setMounted] = useState(false)

  // Initialize from localStorage
  useEffect(() => {
    const saved = (localStorage.getItem("oxen_theme") as Theme) || "dark"
    setThemeState(saved)
    const resolved = saved === "system" ? getSystemTheme() : saved
    setResolvedTheme(resolved)
    applyTheme(resolved)
    setMounted(true)
  }, [])

  // Listen for system theme changes when mode is "system"
  useEffect(() => {
    if (!mounted || theme !== "system") return
    const mq = window.matchMedia("(prefers-color-scheme: light)")
    const handler = () => {
      const resolved = mq.matches ? "light" : "dark"
      setResolvedTheme(resolved)
      applyTheme(resolved)
    }
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [theme, mounted])

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t)
    localStorage.setItem("oxen_theme", t)
    const resolved = t === "system" ? getSystemTheme() : t
    setResolvedTheme(resolved)
    applyTheme(resolved)
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
