interface DonutSegment {
  label: string
  amount: number
  color: string
}

interface PaymentMethodDonutProps {
  segments: DonutSegment[]
  size?: number
}

const STROKE_WIDTH = 20

interface PositionedSegment extends DonutSegment {
  length: number
  offset: number
}

function positionSegments(segments: DonutSegment[], circumference: number, total: number): PositionedSegment[] {
  return segments.reduce<PositionedSegment[]>((positioned, segment) => {
    const previous = positioned.at(-1)
    const offset = previous ? previous.offset + previous.length : 0
    const length = (segment.amount / total) * circumference
    return [...positioned, { ...segment, length, offset }]
  }, [])
}

export function PaymentMethodDonut({ segments, size = 148 }: PaymentMethodDonutProps) {
  const total = segments.reduce((sum, s) => sum + s.amount, 0) || 1
  const radius = size / 2 - STROKE_WIDTH / 2
  const circumference = 2 * Math.PI * radius
  const visibleSegments = segments.filter((s) => s.amount > 0)
  const positionedSegments = positionSegments(visibleSegments, circumference, total)

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="mx-auto">
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#f5f5f4" strokeWidth={STROKE_WIDTH} />
        {positionedSegments.map((segment) => (
          <circle
            key={segment.label}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={segment.color}
            strokeWidth={STROKE_WIDTH}
            strokeDasharray={`${segment.length} ${circumference - segment.length}`}
            strokeDashoffset={-segment.offset}
            strokeLinecap={positionedSegments.length > 1 ? 'butt' : 'round'}
          />
        ))}
      </g>
    </svg>
  )
}
