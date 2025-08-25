import React, { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Navigation } from './components/Navigation'
import { ScoringBuilder } from './components/ScoringBuilder'
import { PlayerExplorer } from './components/PlayerExplorer'
import { DraftRoom } from './components/DraftRoom'
import { OAuthCallback } from './components/OAuthCallback'
import './styles/design-system.css'

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      retry: 3,
      refetchOnWindowFocus: false,
    },
  },
})

function App() {
  const [currentPage, setCurrentPage] = useState('draft-room')

  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="app">
          <Navigation currentPage={currentPage} onPageChange={setCurrentPage} />
          
          <main className="main-content">
            <Routes>
              <Route 
                path="/" 
                element={
                  <div className="page-header">
                    <div className="container">
                      <h1 className="page-title">🏈 NFLDrafter</h1>
                      <p className="page-subtitle">
                        Your local-first fantasy football scoring application with custom profiles and advanced analytics
                      </p>
                      
                      <div className="stats-grid">
                        <div className="stat-card">
                          <div className="stat-value">27</div>
                          <div className="stat-label">Features Complete</div>
                        </div>
                        <div className="stat-card">
                          <div className="stat-value">67.5%</div>
                          <div className="stat-label">Project Complete</div>
                        </div>
                        <div className="stat-card">
                          <div className="stat-value">1000+</div>
                          <div className="stat-label">Players Available</div>
                        </div>
                        <div className="stat-card">
                          <div className="stat-value">4</div>
                          <div className="stat-label">Seasons Data</div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                        <div className="card">
                          <div className="card-header">
                            <h2 className="text-xl font-semibold">🚀 Quick Start</h2>
                          </div>
                          <div className="card-body">
                            <p className="text-gray-600 mb-4">
                              Get started with NFLDrafter in just a few clicks. Create custom scoring profiles, explore player data, and dive into the draft room.
                            </p>
                            <div className="space-y-3">
                              <button 
                                className="btn btn-primary w-full"
                                onClick={() => setCurrentPage('draft-room')}
                              >
                                Enter Draft Room
                              </button>
                              <button 
                                className="btn btn-secondary w-full"
                                onClick={() => setCurrentPage('scoring-builder')}
                              >
                                Build Scoring Profile
                              </button>
                            </div>
                          </div>
                        </div>
                        
                        <div className="card">
                          <div className="card-header">
                            <h2 className="text-xl font-semibold">📊 Key Features</h2>
                          </div>
                          <div className="card-body">
                            <div className="space-y-3">
                              <div className="flex items-center space-x-3">
                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                <span className="text-sm">Custom scoring profiles with flexible rules</span>
                              </div>
                              <div className="flex items-center space-x-3">
                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                <span className="text-sm">Advanced player analytics and VORP calculations</span>
                              </div>
                              <div className="flex items-center space-x-3">
                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                <span className="text-sm">Professional draft room with tiering and watchlists</span>
                              </div>
                              <div className="flex items-center space-x-3">
                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                <span className="text-sm">Offline support with IndexedDB caching</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                } 
              />
              <Route 
                path="/scoring-builder" 
                element={
                  <div className="page-header">
                    <div className="container">
                      <h1 className="page-title">⚙️ Scoring Builder</h1>
                      <p className="page-subtitle">
                        Create and customize fantasy football scoring profiles with flexible rules and real-time calculations
                      </p>
                    </div>
                    <ScoringBuilder />
                  </div>
                } 
              />
              <Route 
                path="/player-explorer" 
                element={
                  <div className="page-header">
                    <div className="container">
                      <h1 className="page-title">🔍 Player Explorer</h1>
                      <p className="page-subtitle">
                        Explore comprehensive player data, statistics, and rankings across multiple seasons
                      </p>
                    </div>
                    <PlayerExplorer />
                  </div>
                } 
              />
              <Route 
                path="/draft-room" 
                element={
                  <div className="page-header">
                    <div className="container">
                      <h1 className="page-title">🏆 Draft Room</h1>
                      <p className="page-subtitle">
                        Professional draft experience with advanced analytics, tiering, and real-time insights
                      </p>
                    </div>
                    <DraftRoom />
                  </div>
                } 
              />
              <Route 
                path="/auth/callback" 
                element={<OAuthCallback />} 
              />
            </Routes>
          </main>
        </div>
      </Router>
    </QueryClientProvider>
  )
}

export default App
