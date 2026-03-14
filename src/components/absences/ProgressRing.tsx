"use client"

import { FROST, TEXT_TERTIARY } from "./constants"

interface ProgressRingProps {
  used: number
  pending: number
  total: number
  color: string
  pendingColor: string
  size?: number
}

export default function ProgressRing({ used, pending, total, color, pendingColor, size = 100 }: ProgressRingProps) {
  const strokeWidth = 8
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const usedPct = total > 0 ? (used / total) : 0
  const pendingPct = total > 0 ? (pending / total) : 0
  const usedOffset = circumference * (1 - usedPct)
  const remaining = Math.max(0, total - used - pending)

  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={pendingColor} strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - usedPct - pendingPct)}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={usedOffset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <div style={{
        position: "absolute", inset: 0, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
      }}>
        <span style={{ fontFamily: "'Bellfair', serif", fontSize: 24, color: FROST, lineHeight: 1 }}>{remaining}</span>
        <span style={{ fontSize: 8, color: TEXT_TERTIARY, textTransform: "uppercase", letterSpacing: 1 }}>left</span>
      </div>
    </div>
  )
}
