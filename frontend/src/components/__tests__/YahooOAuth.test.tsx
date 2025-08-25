import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { YahooOAuth } from '../YahooOAuth'
import { ToastProvider } from '../Toast'

// Mock the Toast context
const mockAddToast = vi.fn()

vi.mock('../Toast', async () => {
  const actual = await vi.importActual('../Toast')
  return {
    ...actual,
    useToast: () => ({
      addToast: mockAddToast
    })
  }
})

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
}
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
})

// Mock fetch
global.fetch = vi.fn()

// Mock window.location.href
Object.defineProperty(window, 'location', {
  value: {
    href: '',
    origin: 'http://localhost:5173'
  },
  writable: true
})

describe('YahooOAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.getItem.mockReturnValue(null)
  })

  it('renders connect button when not authenticated', () => {
    render(
      <ToastProvider>
        <YahooOAuth />
      </ToastProvider>
    )

    expect(screen.getByText('Connect Yahoo Account')).toBeInTheDocument()
    expect(screen.getByText('Connect Yahoo Fantasy Football')).toBeInTheDocument()
  })

  it('shows loading state when authenticating', () => {
    render(
      <ToastProvider>
        <YahooOAuth />
      </ToastProvider>
    )

    const connectButton = screen.getByText('Connect Yahoo Account')
    fireEvent.click(connectButton)

    expect(screen.getByText('Connecting to Yahoo...')).toBeInTheDocument()
  })

  it('shows connected state when authenticated', async () => {
    localStorageMock.getItem
      .mockReturnValueOnce('mock-access-token') // access token
      .mockReturnValueOnce('mock-refresh-token') // refresh token

    // Mock successful token verification
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'yahoo_user_123',
          email: 'user@example.com',
          name: 'Fantasy Football User'
        })
      })

    render(
      <ToastProvider>
        <YahooOAuth />
      </ToastProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('Connected to Yahoo')).toBeInTheDocument()
    })

    expect(screen.getByText('Disconnect')).toBeInTheDocument()
  })

  it('handles disconnect action', async () => {
    localStorageMock.getItem
      .mockReturnValueOnce('mock-access-token')
      .mockReturnValueOnce('mock-refresh-token')

    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'yahoo_user_123',
          email: 'user@example.com',
          name: 'Fantasy Football User'
        })
      })

    render(
      <ToastProvider>
        <YahooOAuth />
      </ToastProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('Connected to Yahoo')).toBeInTheDocument()
    })

    const disconnectButton = screen.getByText('Disconnect')
    fireEvent.click(disconnectButton)

    expect(localStorageMock.removeItem).toHaveBeenCalledWith('yahoo_access_token')
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('yahoo_refresh_token')
    expect(mockAddToast).toHaveBeenCalledWith({
      type: 'info',
      title: 'Disconnected',
      message: 'Successfully disconnected from Yahoo Fantasy Football',
      duration: 3000
    })
  })

  it('shows error when authentication fails', async () => {
    localStorageMock.getItem
      .mockReturnValueOnce('invalid-token')
      .mockReturnValueOnce('invalid-refresh-token')

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false
    })

    render(
      <ToastProvider>
        <YahooOAuth />
      </ToastProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('Authentication expired. Please sign in again.')).toBeInTheDocument()
    })
  })

  it('calls onAuthSuccess callback when authentication succeeds', async () => {
    const mockOnAuthSuccess = vi.fn()
    
    localStorageMock.getItem
      .mockReturnValueOnce('mock-access-token')
      .mockReturnValueOnce('mock-refresh-token')

    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'yahoo_user_123',
          email: 'user@example.com',
          name: 'Fantasy Football User'
        })
      })

    render(
      <ToastProvider>
        <YahooOAuth onAuthSuccess={mockOnAuthSuccess} />
      </ToastProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('Connected to Yahoo')).toBeInTheDocument()
    })

    expect(mockOnAuthSuccess).toHaveBeenCalledWith('mock-access-token', 'mock-refresh-token')
  })
})
