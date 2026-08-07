import type { DraftConfidence } from '../types'

interface DraftConfidenceBadgeProps {
  confidence?: DraftConfidence
  compact?: boolean
}

const tone = {
  high: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  medium: 'border-blue-200 bg-blue-50 text-blue-800',
  low: 'border-amber-200 bg-amber-50 text-amber-800',
  limited: 'border-slate-200 bg-slate-100 text-slate-600',
}

export function DraftConfidenceBadge({ confidence, compact = false }: DraftConfidenceBadgeProps) {
  if (!confidence) return <span className="text-xs text-slate-400">{compact ? '—' : 'No confidence data'}</span>
  const label = confidence.level === 'limited'
    ? 'Limited' : `${confidence.level[0].toUpperCase()}${confidence.level.slice(1)}`
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border font-bold ${tone[confidence.level]} ${compact ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-xs'}`}
      title={`${confidence.score}/100 confidence · ${confidence.evidence}`}
      aria-label={`${label} draft confidence, ${confidence.score} out of 100`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}{compact ? '' : ` · ${confidence.score}`}
    </span>
  )
}
