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
  const [val, setVal] = useState(0)

  useEffect(() => {
    let s = 0
    const step = target / (duration / 16)
    const t = setInterval(() => {
      s += step
      if (s >= target) {
        setVal(target)
        clearInterval(t)
      } else {
        setVal(Math.floor(s))
      }
    }, 16)
    return () => clearInterval(t)
  }, [target, duration])

  return (
    <span>
      {prefix}
      {val.toLocaleString()}
    </span>
  )
}
