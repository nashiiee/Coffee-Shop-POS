import type { HourlySalesPoint } from './types'

interface HourlySalesChartProps {
  points: HourlySalesPoint[]
}

const WIDTH = 900
const HEIGHT = 220
const PADDING_LEFT = 48
const PADDING_RIGHT = 12
const PADDING_TOP = 12
const PADDING_BOTTOM = 24
const LABELED_HOURS = [0, 4, 8, 12, 16, 20]
const LINE_COLOR = '#b45309'

function formatHourLabel(hour: number): string {
  const period = hour < 12 ? 'AM' : 'PM'
  const displayHour = hour % 12 === 0 ? 12 : hour % 12
  return `${displayHour} ${period}`
}

// Rounds up to a "nice" axis ceiling (1/2/5 x a power of ten) so gridlines
// read as round numbers (₱10k, ₱20k...) instead of the raw data max.
function niceMax(value: number): number {
  if (value <= 0) return 1000
  const magnitude = 10 ** Math.floor(Math.log10(value))
  const residual = value / magnitude
  const step = residual <= 1 ? 1 : residual <= 2 ? 2 : residual <= 5 ? 5 : 10
  return step * magnitude
}

function formatAxisPesos(pesos: number): string {
  if (pesos === 0) return '₱0'
  if (pesos % 1000 === 0) return `₱${pesos / 1000}k`
  return `₱${(pesos / 1000).toFixed(1)}k`
}

export function HourlySalesChart({ points }: HourlySalesChartProps) {
  const maxPesos = Math.max(...points.map((p) => p.totalSales / 100), 0)
  const axisMax = niceMax(maxPesos)
  const innerWidth = WIDTH - PADDING_LEFT - PADDING_RIGHT
  const innerHeight = HEIGHT - PADDING_TOP - PADDING_BOTTOM
  const stepX = points.length > 1 ? innerWidth / (points.length - 1) : 0

  const coords = points.map((point, i) => {
    const x = PADDING_LEFT + i * stepX
    const y = PADDING_TOP + innerHeight - (point.totalSales / 100 / axisMax) * innerHeight
    return { x, y, point }
  })

  const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ')
  const areaPath =
    coords.length > 0
      ? `${linePath} L ${coords.at(-1)!.x.toFixed(1)} ${(HEIGHT - PADDING_BOTTOM).toFixed(1)} ` +
        `L ${coords[0]!.x.toFixed(1)} ${(HEIGHT - PADDING_BOTTOM).toFixed(1)} Z`
      : ''

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((fraction) => ({
    fraction,
    pesos: Math.round(axisMax * fraction),
    y: PADDING_TOP + innerHeight * (1 - fraction),
  }))

  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-sm text-stone-500">
        <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: LINE_COLOR }} />
        Sales (₱)
      </div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" role="img" aria-label="Sales by hour today">
        <defs>
          <linearGradient id="hourlyTrendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={LINE_COLOR} stopOpacity="0.22" />
            <stop offset="100%" stopColor={LINE_COLOR} stopOpacity="0" />
          </linearGradient>
        </defs>

        {yTicks.map((tick) => (
          <g key={tick.fraction}>
            <line x1={PADDING_LEFT} y1={tick.y} x2={WIDTH - PADDING_RIGHT} y2={tick.y} stroke="#ede0c8" strokeWidth={1} />
            <text x={PADDING_LEFT - 8} y={tick.y + 3} textAnchor="end" className="fill-stone-400 text-[10px]">
              {formatAxisPesos(tick.pesos)}
            </text>
          </g>
        ))}

        {areaPath ? <path d={areaPath} fill="url(#hourlyTrendFill)" /> : null}
        {linePath ? <path d={linePath} fill="none" stroke={LINE_COLOR} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /> : null}

        {coords.map((c) => (
          <circle key={c.point.hour} cx={c.x} cy={c.y} r={2.5} fill="#fff" stroke={LINE_COLOR} strokeWidth={1.5} />
        ))}

        {LABELED_HOURS.map((hour) => {
          const c = coords[hour]
          if (!c) return null
          return (
            <text key={hour} x={c.x} y={HEIGHT - 6} textAnchor="middle" className="fill-stone-500 text-[10px] font-medium">
              {formatHourLabel(hour)}
            </text>
          )
        })}
      </svg>
    </div>
  )
}
