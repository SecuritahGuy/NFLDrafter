import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter as Router, Link, Route, Routes } from 'react-router-dom'
import { Navigation } from './components/Navigation'
import { ScoringBuilder } from './components/ScoringBuilder'
import { PlayerExplorer } from './components/PlayerExplorer'
import { DraftRoom } from './components/DraftRoom'
import { OAuthCallback } from './components/OAuthCallback'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 3,
      refetchOnWindowFocus: false,
    },
  },
})

const Home: React.FC = () => (
  <div className="min-h-[calc(100vh-3rem)] bg-slate-950 text-white">
    <section className="relative isolate overflow-hidden border-b border-white/10">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.28),_transparent_38%),radial-gradient(circle_at_80%_20%,_rgba(249,115,22,0.16),_transparent_30%)]" />
      <div className="mx-auto grid max-w-6xl gap-12 px-6 py-20 lg:grid-cols-[1.2fr_0.8fr] lg:items-center lg:py-28">
        <div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-400/30 bg-blue-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-blue-200">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            2026 draft workspace
          </div>
          <h1 className="max-w-3xl text-4xl font-black tracking-tight sm:text-6xl">
            Make the pick with a clear board and a calm clock.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
            Build your scoring model, prepare an offline draft package, and track every pick from one focused workspace. Yahoo import is optional—not a dependency.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-950/30 transition hover:bg-blue-500" to="/draft-room">
              Open draft room <span aria-hidden="true" className="ml-2">→</span>
            </Link>
            <Link className="inline-flex items-center justify-center rounded-lg border border-slate-600 bg-slate-900/70 px-5 py-3 text-sm font-bold text-slate-100 transition hover:border-slate-400 hover:bg-slate-800" to="/scoring-builder">
              Tune scoring
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-900/75 p-5 shadow-2xl shadow-black/30 backdrop-blur">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Draft-day flow</p>
              <p className="mt-1 text-lg font-bold">Ready when the room opens</p>
            </div>
            <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">Local first</span>
          </div>
          <div className="mt-4 space-y-3">
            {[
              ['01', 'Set your scoring', 'Use a saved profile or import league rules.'],
              ['02', 'Prepare the board', 'Rank, tier, watch, and export before draft night.'],
              ['03', 'Track every pick', 'Run the room even if an external service drops.'],
            ].map(([step, title, copy]) => (
              <div className="flex gap-4 rounded-xl border border-white/5 bg-white/[0.03] p-4" key={step}>
                <span className="font-mono text-sm font-bold text-orange-400">{step}</span>
                <div>
                  <p className="font-bold text-white">{title}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-400">{copy}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>

    <section className="mx-auto grid max-w-6xl gap-4 px-6 py-12 md:grid-cols-3">
      {[
        ['Scoring that fits', 'Model league-specific rules and compare projections against the numbers that matter to you.'],
        ['A board built for speed', 'Filter, search, watch, and draft without fighting a spreadsheet when the clock is running.'],
        ['Portable by design', 'Save a complete draft package locally and bring it back without relying on a live integration.'],
      ].map(([title, copy]) => (
        <article className="rounded-xl border border-slate-800 bg-slate-900/60 p-6" key={title}>
          <h2 className="text-lg font-bold">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">{copy}</p>
        </article>
      ))}
    </section>
  </div>
)

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="app">
          <Navigation />
          <main className="main-content">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/scoring-builder" element={
                <div className="page-header">
                  <div className="container">
                    <h1 className="page-title">⚙️ Scoring Builder</h1>
                    <p className="page-subtitle">Create and customize fantasy football scoring profiles with flexible rules and real-time calculations</p>
                  </div>
                  <ScoringBuilder />
                </div>
              } />
              <Route path="/player-explorer" element={
                <div className="page-header">
                  <div className="container">
                    <h1 className="page-title">🔍 Player Explorer</h1>
                    <p className="page-subtitle">Explore player data, statistics, and rankings across multiple seasons</p>
                  </div>
                  <PlayerExplorer />
                </div>
              } />
              <Route path="/draft-room" element={<DraftRoom />} />
              <Route path="/auth/callback" element={<OAuthCallback />} />
            </Routes>
          </main>
        </div>
      </Router>
    </QueryClientProvider>
  )
}

export default App
