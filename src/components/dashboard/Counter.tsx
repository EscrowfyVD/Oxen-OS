"use client"

import { useEffect, useState } from "react"

interface CounterProps {
  target: number
  prefix?: string
  duration?: number
}

export default function Counter({
  target,
  prefix = "",
  duration = 1200,
}: CounterProps) {
  // Defensive: ensure target is always a finite number
  const safeTarget = Number.isFinite(target) ? target : 0
  const [val, setVal] = useState(0)

  useEffect(() => {
    // If target is 0 or invalid, set immediately
    if (safeTarget === 0) {
      setVal(0)
      return
    }

    let s = 0
    const step = safeTarget / (duration / 16)

    // Guard against infinite loops (step=0 or NaN)
    if (!Number.isFinite(step) || step === 0) {
      setVal(safeTarget)
      return
    }

    const t = setInterval(() => {
      s += step
      if (s >= safeTarget) {
        setVal(safeTarget)
        clearInterval(t)
      } else {
        setVal(Math.floor(s))
      }
    }, 16)
    return () => clearInterval(t)
  }, [safeTarget, duration])

  return (
    <span>
      {prefix}
      {Number.isFinite(val) ? val.toLocaleString() : "0"}
    </span>
  )
}
