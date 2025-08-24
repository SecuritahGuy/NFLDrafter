import React from 'react'
import { Link, useLocation } from 'react-router-dom'

interface NavigationProps {
  currentPage: string
  onPageChange: (page: string) => void
}

export const Navigation: React.FC<NavigationProps> = ({ currentPage, onPageChange }) => {
  const location = useLocation()

  const navItems = [
    { path: '/', label: 'Home', icon: '🏠' },
    { path: '/draft-room', label: 'Draft Room', icon: '🏆' },
    { path: '/scoring-builder', label: 'Scoring', icon: '⚙️' },
    { path: '/player-explorer', label: 'Players', icon: '🔍' },
  ]

  const handleNavClick = (page: string) => {
    onPageChange(page)
  }

  return (
    <nav className="nav">
      <div className="nav-container">
        <Link to="/" className="nav-brand" onClick={() => handleNavClick('home')}>
          🏈 NFLDrafter
        </Link>
        
        <div className="nav-menu">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`nav-link ${isActive ? 'active' : ''}`}
                onClick={() => handleNavClick(item.path.slice(1).replace('-', '_') || 'home')}
              >
                <span className="mr-2">{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="hidden md:flex items-center space-x-2 text-sm text-gray-600">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span>v1.0.0</span>
          </div>
          
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-gray-600 hidden sm:block">Online</span>
          </div>
        </div>
      </div>
    </nav>
  )
}
