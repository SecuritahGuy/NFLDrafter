import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { 
  HomeIcon, 
  TrophyIcon, 
  Cog6ToothIcon, 
  MagnifyingGlassIcon,
  SignalIcon,
  WifiIcon
} from '@heroicons/react/24/outline'

interface NavigationProps {
  currentPage: string
  onPageChange: (page: string) => void
}

export const Navigation: React.FC<NavigationProps> = ({ currentPage, onPageChange }) => {
  const location = useLocation()

  const navItems = [
    { path: '/', label: 'Home', icon: HomeIcon },
    { path: '/draft-room', label: 'Draft Room', icon: TrophyIcon },
    { path: '/scoring-builder', label: 'Scoring', icon: Cog6ToothIcon },
    { path: '/player-explorer', label: 'Players', icon: MagnifyingGlassIcon },
  ]

  const handleNavClick = (page: string) => {
    onPageChange(page)
  }

  return (
    <nav className="nav">
      <div className="nav-container">
        <Link to="/" className="nav-brand" onClick={() => handleNavClick('home')}>
          <div className="nav-brand-content">
            <div className="nav-brand-icon">🏈</div>
            <div className="nav-brand-text">
              <span className="nav-brand-title">NFLDrafter</span>
              <span className="nav-brand-subtitle">Fantasy Football</span>
            </div>
          </div>
        </Link>
        
        <div className="nav-menu">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path
            const IconComponent = item.icon
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`nav-link ${isActive ? 'active' : ''}`}
                onClick={() => handleNavClick(item.path.slice(1).replace('-', '_') || 'home')}
              >
                <IconComponent className="nav-link-icon" />
                <span className="nav-link-text">{item.label}</span>
              </Link>
            )
          })}
        </div>
        
        <div className="nav-status">
          <div className="nav-status-item">
            <div className="nav-status-indicator online"></div>
            <span className="nav-status-text">v1.0.0</span>
          </div>
          
          <div className="nav-status-item">
            <WifiIcon className="nav-status-icon" />
            <span className="nav-status-text">Online</span>
          </div>
        </div>
      </div>
    </nav>
  )
}
