import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { Navigation } from '../Navigation'

// Mock useLocation
const mockUseLocation = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useLocation: () => mockUseLocation(),
  }
})

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  )
}

describe('Navigation', () => {
  beforeEach(() => {
    mockUseLocation.mockReturnValue({ pathname: '/' })
  })

  it('renders the application title', () => {
    renderWithRouter(<Navigation currentPage="home" onPageChange={vi.fn()} />)
    
    expect(screen.getByText(/NFLDrafter/)).toBeInTheDocument()
  })

  it('renders navigation links', () => {
    renderWithRouter(<Navigation currentPage="home" onPageChange={vi.fn()} />)
    
    expect(screen.getByText('Scoring')).toBeInTheDocument()
    expect(screen.getByText('Players')).toBeInTheDocument()
  })

  it('renders links with correct href attributes', () => {
    renderWithRouter(<Navigation currentPage="home" onPageChange={vi.fn()} />)
    
    const scoringLink = screen.getByRole('link', { name: /Scoring/ })
    const playersLink = screen.getByRole('link', { name: /Players/ })
    
    expect(scoringLink).toHaveAttribute('href', '/scoring-builder')
    expect(playersLink).toHaveAttribute('href', '/player-explorer')
  })

  it('applies active styling to current page link', () => {
    mockUseLocation.mockReturnValue({ pathname: '/scoring-builder' })
    renderWithRouter(<Navigation currentPage="scoring_builder" onPageChange={vi.fn()} />)
    
    const scoringLink = screen.getByRole('link', { name: /Scoring/ })
    
    // Check that the active link has the active class
    expect(scoringLink).toHaveClass('active')
  })

  it('applies hover styling to non-active links', () => {
    renderWithRouter(<Navigation currentPage="home" onPageChange={vi.fn()} />)
    
    const playersLink = screen.getByRole('link', { name: /Players/ })
    
    // Check that non-active links don't have active class
    expect(playersLink).not.toHaveClass('active')
  })

  it('has proper navigation structure', () => {
    renderWithRouter(<Navigation currentPage="home" onPageChange={vi.fn()} />)
    
    const nav = screen.getByRole('navigation')
    expect(nav).toBeInTheDocument()
    expect(nav).toHaveClass('nav')
  })

  it('calls onPageChange when navigation items are clicked', () => {
    const mockOnPageChange = vi.fn()
    renderWithRouter(<Navigation currentPage="home" onPageChange={mockOnPageChange} />)
    
    const scoringLink = screen.getByRole('link', { name: /Scoring/ })
    scoringLink.click()
    
    expect(mockOnPageChange).toHaveBeenCalledWith('scoring_builder')
  })

  it('displays version and status information', () => {
    renderWithRouter(<Navigation currentPage="home" onPageChange={vi.fn()} />)
    
    expect(screen.getByText('v1.0.0')).toBeInTheDocument()
    expect(screen.getByText('Online')).toBeInTheDocument()
  })
})
