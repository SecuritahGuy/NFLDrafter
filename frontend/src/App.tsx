import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import './App.css'
import { ScoringBuilder } from './components/ScoringBuilder'
import { PlayerExplorer } from './components/PlayerExplorer'
import { DraftRoom } from './components/DraftRoom'
import { Navigation } from './components/Navigation'

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="min-h-screen bg-gray-50">
          <Navigation />
          <main className="container mx-auto px-4 py-8">
            <Routes>
              <Route path="/" element={<ScoringBuilder />} />
              <Route path="/explorer" element={<PlayerExplorer />} />
              <Route path="/draft" element={<DraftRoom />} />
            </Routes>
          </main>
        </div>
      </Router>
    </QueryClientProvider>
  )
}

export default App
