import { Link, useLocation } from 'react-router-dom'

export function Navigation() {
  const location = useLocation()
  
  const navItems = [
    { path: '/', label: 'Scoring Builder' },
    { path: '/explorer', label: 'Player Explorer' },
    { path: '/draft', label: 'Draft Room' },
  ]
  
  return (
    <nav className="bg-nfl-blue text-white shadow-lg">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <h1 className="text-xl font-bold">NFLDrafter</h1>
          </div>
          
          <div className="flex space-x-8">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  location.pathname === item.path
                    ? 'bg-fantasy-gold text-nfl-blue'
                    : 'text-white hover:bg-nfl-red hover:text-white'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </nav>
  )
}
