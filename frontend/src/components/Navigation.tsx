import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { 
  HomeIcon, 
  TrophyIcon, 
  Cog6ToothIcon, 
  MagnifyingGlassIcon,
  WifiIcon
} from '@heroicons/react/24/outline'

interface NavigationProps {
  onPageChange: (page: string) => void
}

export const Navigation: React.FC<NavigationProps> = ({ onPageChange }) => {
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
    <nav className="not-prose bg-slate-900 border-b border-slate-700 shadow-md">
      <div className="max-w-6xl mx-auto px-3 sm:px-4 lg:px-6">
        <div className="flex items-center justify-between h-12">
          {/* Brand/Logo */}
          <Link to="/" className="flex items-center space-x-3" onClick={() => handleNavClick('home')}>
            <div className="flex items-center justify-center w-5 h-5 bg-gradient-to-br from-orange-500 to-red-600 rounded-md shadow-sm">
              <span className="text-white text-xs font-bold">🏈</span>
            </div>
                          <div className="flex flex-col">
                <span className="text-white font-bold text-sm leading-tight">NFLDrafter</span>
                <span className="text-slate-300 text-xs font-medium">Fantasy Football</span>
              </div>
          </Link>
          
          {/* Navigation Menu */}
          <div className="hidden md:flex items-center space-x-1 w-auto">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path
              const IconComponent = item.icon
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 whitespace-nowrap ${
                    isActive 
                      ? 'bg-blue-600 text-white shadow-md' 
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                  onClick={() => handleNavClick(item.path.slice(1).replace('-', '_') || 'home')}
                >
                  <IconComponent 
                    className="!h-4 !w-4 flex-none" 
                    aria-hidden="true"
                    style={{ width: '1rem', height: '1rem', flexShrink: 0 }}
                  />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </div>
          
          {/* Status Indicators */}
          <div className="flex items-center space-x-3 w-auto">
            <div className="flex items-center space-x-1.5 text-slate-300 whitespace-nowrap">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
              <span className="text-xs font-medium">v1.0.0</span>
            </div>
            
            <div className="flex items-center space-x-1.5 text-slate-300 whitespace-nowrap">
              <WifiIcon 
                className="!h-4 !w-4 flex-none" 
                aria-hidden="true"
                style={{ width: '1rem', height: '1rem', flexShrink: 0 }}
              />
              <span className="text-xs font-medium">Online</span>
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}
