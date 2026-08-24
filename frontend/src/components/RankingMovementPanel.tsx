import { ArrowDownIcon, ArrowUpIcon, MinusIcon } from '@heroicons/react/20/solid'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { RankingHistoryPoint, RankingSourceId } from '../api'
import { useRankingHistory } from '../hooks/useRankings'
import { buildRankingMovementSeries, type RankingHistoryBySource } from '../utils/rankingMovement'

type SeriesKey = 'fantasyPros' | 'espn' | 'ffc'

const sources: Array<{ id: RankingSourceId; key: SeriesKey; label: string; color: string }> = [
  { id: 'fantasypros-ecr', key: 'fantasyPros', label: 'FantasyPros', color: '#2563eb' },
  { id: 'espn-draft-rank', key: 'espn', label: 'ESPN', color: '#dc2626' },
  { id: 'ffc-adp', key: 'ffc', label: 'FFC ADP', color: '#7c3aed' },
]

const shortDate = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
  month: 'short', day: 'numeric',
})

function movementFor(history: RankingHistoryPoint[]) {
  if (history.length < 2) return null
  const previous = history.at(-2)?.ecr ?? history.at(-2)?.rank
  const latest = history.at(-1)?.ecr ?? history.at(-1)?.rank
  return previous != null && latest != null ? previous - latest : null
}

export function RankingMovementPanel({ playerId }: { playerId: string }) {
  const fantasyPros = useRankingHistory(playerId, 'fantasypros-ecr')
  const espn = useRankingHistory(playerId, 'espn-draft-rank')
  const ffc = useRankingHistory(playerId, 'ffc-adp')
  const histories: RankingHistoryBySource = {
    'fantasypros-ecr': fantasyPros.data?.history,
    'espn-draft-rank': espn.data?.history,
    'ffc-adp': ffc.data?.history,
  }
  const chartData = buildRankingMovementSeries(histories)
  const isLoading = fantasyPros.isLoading || espn.isLoading || ffc.isLoading
  const availableSources = sources.filter((source) => (histories[source.id]?.length ?? 0) > 0)

  return (
    <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="font-bold text-slate-900">Ranking movement</h4>
          <p className="mt-1 text-xs text-slate-500">Daily consensus and market snapshots. A lower rank is better.</p>
        </div>
        <div className="text-xs font-semibold text-slate-500">{availableSources.length}/3 feeds available</div>
      </div>

      {isLoading && chartData.length === 0 ? (
        <div className="mt-4 rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">Loading ranking history…</div>
      ) : chartData.length < 2 ? (
        <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
          Collecting history. The daily snapshot job needs at least two dates before a trend can be drawn.
        </div>
      ) : (
        <div className="mt-4 h-56" aria-label="Player ranking movement chart">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11 }} />
              <YAxis reversed allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip labelFormatter={(value) => shortDate(String(value))} formatter={(value) => [`#${Number(value).toFixed(1)}`, 'Rank']} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {sources.map((source) => (
                <Line key={source.id} type="monotone" dataKey={source.key} name={source.label} stroke={source.color} strokeWidth={2.5} connectNulls={false} dot={{ r: 3 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {sources.map((source) => {
          const history = histories[source.id] ?? []
          const movement = movementFor(history)
          const latest = history.at(-1)
          const Icon = movement == null || movement === 0 ? MinusIcon : movement > 0 ? ArrowUpIcon : ArrowDownIcon
          const tone = movement == null || movement === 0 ? 'text-slate-500' : movement > 0 ? 'text-emerald-700' : 'text-rose-700'
          return (
            <div key={source.id} className="rounded-xl bg-slate-50 p-3">
              <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{source.label}</div>
              <div className={`mt-1 flex items-center gap-1 text-sm font-black ${tone}`}>
                <Icon className="h-4 w-4" />
                {movement == null ? 'Baseline' : movement === 0 ? 'No change' : `${movement > 0 ? '+' : ''}${movement.toFixed(1)} spots`}
              </div>
              <div className="mt-1 text-[10px] text-slate-500">{latest ? `Latest ${shortDate(latest.snapshot_date)}` : 'No matched snapshot'}</div>
            </div>
          )
        })}
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-500">Gaps mean a feed did not have a matched player snapshot that day. Movement describes market rank—not projected points or injury risk.</p>
    </div>
  )
}
