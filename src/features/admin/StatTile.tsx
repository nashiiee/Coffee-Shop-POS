import type { ComponentType, ReactNode } from 'react'

// Shared hue system for admin stat cards — chosen to sit apart on the color
// wheel rather than all leaning on the brand amber: primary (amber, the
// brand/espresso tone), secondary (slate, neutral/informational), tertiary
// (teal, positive-motion), info (blue), violet (a fifth accent for
// less-common metrics), and alert (rose — warm-adjacent rather than a
// clashing cold red). `stroke` is the matching hex used to color each
// tile's own mini sparkline so the line, chip, and icon read as one accent.
const STAT_TONE_STYLES = {
  primary: { chip: 'bg-amber-50 text-amber-700', stroke: '#b45309' },
  secondary: { chip: 'bg-slate-100 text-slate-700', stroke: '#475569' },
  tertiary: { chip: 'bg-teal-50 text-teal-700', stroke: '#0d9488' },
  green: { chip: 'bg-emerald-50 text-emerald-700', stroke: '#059669' },
  info: { chip: 'bg-sky-50 text-sky-700', stroke: '#0284c7' },
  violet: { chip: 'bg-violet-50 text-violet-700', stroke: '#7c3aed' },
  alert: { chip: 'bg-rose-50 text-rose-600', stroke: '#e11d48' },
} as const

type StatTone = keyof typeof STAT_TONE_STYLES

export function ChangeBadge({ percent, suffix = 'vs. yesterday' }: { percent: number | null; suffix?: string }) {
  if (percent === null) return <span className="text-xs font-medium text-stone-400">{suffix}: n/a</span>
  const isUp = percent >= 0
  return (
    <span className={`text-xs font-semibold ${isUp ? 'text-emerald-600' : 'text-rose-600'}`}>
      {isUp ? '▲' : '▼'} {Math.abs(percent).toFixed(1)}% {suffix}
    </span>
  )
}

const SPARKLINE_WIDTH = 200
const SPARKLINE_HEIGHT = 40
const SPARKLINE_PADDING = 4

function MiniSparkline({ points, color }: { points: number[]; color: string }) {
  if (points.length < 2) return null
  const gradientId = `spark-${color.replace('#', '')}`
  const max = Math.max(...points, 1)
  const min = Math.min(...points, 0)
  const range = max - min || 1
  const innerWidth = SPARKLINE_WIDTH - SPARKLINE_PADDING * 2
  const innerHeight = SPARKLINE_HEIGHT - SPARKLINE_PADDING * 2
  const stepX = innerWidth / (points.length - 1)

  const coords = points.map((value, i) => ({
    x: SPARKLINE_PADDING + i * stepX,
    y: SPARKLINE_PADDING + innerHeight - ((value - min) / range) * innerHeight,
  }))
  const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L ${coords.at(-1)!.x.toFixed(1)} ${SPARKLINE_HEIGHT} L ${coords[0]!.x.toFixed(1)} ${SPARKLINE_HEIGHT} Z`

  return (
    <svg viewBox={`0 0 ${SPARKLINE_WIDTH} ${SPARKLINE_HEIGHT}`} className="mt-3 h-10 w-full" aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradientId})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

interface StatTileProps {
  label: string
  value: string
  Icon: ComponentType<{ className?: string }>
  tone: StatTone
  change?: number | null
  status?: ReactNode
  footnote?: ReactNode
  sparkline?: number[]
}

export function StatTile({ label, value, Icon, tone, change, status, footnote, sparkline }: StatTileProps) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-3">
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${STAT_TONE_STYLES[tone].chip}`}>
          <Icon />
        </span>
        <span className="text-sm font-medium text-stone-500">{label}</span>
      </div>
      <p className="mb-1 text-2xl font-semibold text-stone-800">{value}</p>
      {footnote}
      {change !== undefined ? <ChangeBadge percent={change} /> : status}
      {sparkline ? <MiniSparkline points={sparkline} color={STAT_TONE_STYLES[tone].stroke} /> : null}
    </div>
  )
}
