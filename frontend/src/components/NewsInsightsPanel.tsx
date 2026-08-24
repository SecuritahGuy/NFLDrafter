import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api'

interface SleeperCandidate {
  player_id: string
  name: string
  position: string
  team: string
  adp: number
  score: number
  positive_score: number
  risk_score: number
  confidence: 'limited' | 'medium'
  evidence: Array<{
    news_id: string
    title: string
    url: string
    source: string
    topics: string[]
    contribution: number
  }>
}

interface NewsInsightsResponse {
  snapshot_date: string | null
  candidates: SleeperCandidate[]
  team_trends: Array<{
    team: string
    article_count: number
    opportunity_score: number
    risk_score: number
    topics: string[]
  }>
  methodology: string
}

interface NewsSourceResponse {
  sources: Array<{
    source_id: string
    name: string
    homepage_url: string | null
    reliability_tier: string
    article_count: number
    last_published_at: number | null
  }>
  correlations: { player_links: number; team_links: number }
}

export const NewsInsightsPanel: React.FC<{ season: number; leagueSize: number }> = ({ season, leagueSize }) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['news-insights', season, leagueSize],
    queryFn: async () => {
      const [insights, sources] = await Promise.all([
        api.get<NewsInsightsResponse>('/news/insights/sleepers', { params: { season, days: 30, min_adp: 72, limit: 12, league_size: leagueSize } }),
        api.get<NewsSourceResponse>('/news/sources'),
      ])
      return { insights: insights.data, sources: sources.data }
    },
    staleTime: 10 * 60 * 1000,
  })

  if (isLoading) return <div className="rounded-2xl border border-cyan-200 bg-white p-5 text-sm text-slate-500">Loading cached news correlations…</div>
  if (error || !data) return <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">News insights are unavailable until the local correlation cache is built.</div>

  const { insights, sources } = data
  return (
    <section className="space-y-4 rounded-2xl border border-cyan-200 bg-cyan-50 p-5 text-slate-950" aria-label="News-driven draft insights">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><div className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-700">Database-backed news signals</div><h3 className="mt-1 text-xl font-black">Late-round watchlist</h3><p className="mt-1 max-w-3xl text-sm text-slate-600">Players after ADP 72 with direct, recent opportunity evidence. These are investigation prompts—not performance predictions.</p></div>
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-lg bg-white px-3 py-2"><div className="font-black text-lg">{sources.sources.reduce((sum, source) => sum + source.article_count, 0)}</div><div className="text-slate-500">evidence items</div></div>
          <div className="rounded-lg bg-white px-3 py-2"><div className="font-black text-lg">{sources.correlations.player_links}</div><div className="text-slate-500">player links</div></div>
          <div className="rounded-lg bg-white px-3 py-2"><div className="font-black text-lg">{sources.correlations.team_links}</div><div className="text-slate-500">team links</div></div>
        </div>
      </div>

      {sources.sources.length > 0 && <div className="flex flex-wrap gap-2">{sources.sources.map((source) => <a key={source.source_id} href={source.homepage_url ?? '#'} target="_blank" rel="noreferrer" className="rounded-full border border-cyan-200 bg-white px-3 py-1.5 text-xs font-semibold text-cyan-900">{source.name} · {source.article_count} · {source.last_published_at ? new Date(source.last_published_at).toLocaleDateString() : 'no date'}</a>)}</div>}

      {insights.candidates.length ? <div className="grid gap-3 lg:grid-cols-2">{insights.candidates.slice(0, 8).map((candidate) => {
        const likelyRound = Math.ceil(candidate.adp / leagueSize)
        return <article key={candidate.player_id} className="rounded-xl border border-cyan-100 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3"><div><div className="font-black">{candidate.name}</div><div className="text-xs text-slate-500">{candidate.position} · {candidate.team} · ADP {candidate.adp.toFixed(1)} · likely round {likelyRound}</div></div><span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${candidate.confidence === 'medium' ? 'bg-cyan-100 text-cyan-900' : 'bg-slate-100 text-slate-600'}`}>{candidate.confidence} evidence</span></div>
          <div className="mt-2 flex gap-3 text-xs"><span className="font-semibold text-emerald-700">Positive {candidate.positive_score.toFixed(1)}</span>{candidate.risk_score > 0 && <span className="font-semibold text-rose-700">Risk {candidate.risk_score.toFixed(1)}</span>}</div>
          <ul className="mt-3 space-y-1.5">{candidate.evidence.slice(0, 2).map((evidence) => <li key={evidence.news_id}><a href={evidence.url} target="_blank" rel="noreferrer" className="line-clamp-2 text-xs font-semibold text-blue-700 hover:underline">{evidence.title}</a><div className="text-[10px] text-slate-400">{evidence.source.toUpperCase()} · {evidence.topics.join(', ') || 'mention context'}</div></li>)}</ul>
        </article>
      })}</div> : <div className="rounded-xl border border-dashed border-cyan-300 bg-white p-5 text-sm text-slate-600">No positive late-round candidate currently clears the evidence threshold. That is a valid result; the model will not manufacture sleepers from article volume alone.</div>}

      {insights.team_trends.length > 0 && <details className="rounded-xl border border-cyan-200 bg-white p-4"><summary className="cursor-pointer text-sm font-bold">Teams with the most opportunity/risk context</summary><div className="mt-3 flex flex-wrap gap-2">{insights.team_trends.map((team) => <span key={team.team} className="rounded-lg bg-slate-100 px-3 py-2 text-xs"><strong>{team.team}</strong> · {team.article_count} articles · +{team.opportunity_score.toFixed(1)} opp · {team.risk_score.toFixed(1)} risk</span>)}</div></details>}
      <p className="text-xs leading-5 text-cyan-900">{insights.methodology} ADP snapshot: {insights.snapshot_date ?? 'unavailable'}.</p>
    </section>
  )
}
