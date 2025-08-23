import { describe, it, expect } from 'vitest'
import { render, screen } from '../../test/test-utils'
import { Navigation } from '../Navigation'

describe('Navigation', () => {
  it('renders the application title', () => {
    render(<Navigation />)
    
    expect(screen.getByText('NFLDrafter')).toBeInTheDocument()
  })

  it('renders navigation links', () => {
    render(<Navigation />)
    
    expect(screen.getByText('Scoring Builder')).toBeInTheDocument()
    expect(screen.getByText('Player Explorer')).toBeInTheDocument()
  })

  it('renders links with correct href attributes', () => {
    render(<Navigation />)
    
    const scoringBuilderLink = screen.getByRole('link', { name: 'Scoring Builder' })
    const playerExplorerLink = screen.getByRole('link', { name: 'Player Explorer' })
    
    expect(scoringBuilderLink).toHaveAttribute('href', '/')
    expect(playerExplorerLink).toHaveAttribute('href', '/explorer')
  })

  it('applies active styling to current page link', () => {
    // Mock the current location to be the root path
    render(<Navigation />)
    
    const scoringBuilderLink = screen.getByRole('link', { name: 'Scoring Builder' })
    
    // Check that the active link has the active class
    expect(scoringBuilderLink).toHaveClass('bg-fantasy-gold', 'text-nfl-blue')
  })

  it('applies hover styling to non-active links', () => {
    render(<Navigation />)
    
    const playerExplorerLink = screen.getByRole('link', { name: 'Player Explorer' })
    
    // Check that non-active links have hover classes
    expect(playerExplorerLink).toHaveClass('text-white', 'hover:bg-nfl-red', 'hover:text-white')
  })

  it('has proper navigation structure', () => {
    render(<Navigation />)
    
    const nav = screen.getByRole('navigation')
    expect(nav).toBeInTheDocument()
    expect(nav).toHaveClass('bg-nfl-blue', 'text-white', 'shadow-lg')
  })
})
