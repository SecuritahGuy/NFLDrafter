import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import type { InjuryReportEntry } from '../api'

export function InjuryIndicator({ injuries }: { injuries?: InjuryReportEntry[] }) {
  const current = injuries?.[0]
  if (!current) return null

  const injury = current.report_primary_injury
    ?? current.practice_primary_injury
    ?? 'Availability concern'
  const status = current.report_status ?? current.practice_status ?? 'Listed'
  const source = current.season_type === 'ESPN' ? 'ESPN current report' : 'NFL official report'

  return (
    <span className="group/injury relative inline-flex" onClick={(event) => event.stopPropagation()}>
      <span
        aria-label={`${status}: ${injury}. Hover for injury details.`}
        className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-amber-700 ring-1 ring-amber-300 transition group-hover/injury:bg-amber-200 group-hover/injury:text-amber-900"
      >
        <ExclamationTriangleIcon className="h-4 w-4" />
      </span>
      <span role="tooltip" className="pointer-events-none absolute left-0 top-8 z-30 hidden w-64 rounded-lg bg-slate-950 px-3 py-2 text-left text-xs leading-5 text-white shadow-xl group-hover/injury:block group-focus-within/injury:block">
        <span className="block font-bold text-amber-300">{status} · {injury}</span>
        <span className="block text-slate-300">{source}</span>
      </span>
    </span>
  )
}
