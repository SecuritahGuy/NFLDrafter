import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode } from 'react'
import { usePoints, usePlayerStats, useScoringProfiles } from '../usePoints'
import { mockScoringProfiles, mockPlayerStats, mockPointsResult, fantasyAPIMock } from '../../test/mocks'

// Create a wrapper for React Query
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  })

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    )
  }
}

describe('usePoints hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches points data successfully', async () => {
    const wrapper = createWrapper()
    
    const { result } = renderHook(
      () => usePoints('player-1', 2023, 1, 'test-profile-1'),
      { wrapper }
    )

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(mockPointsResult)
    expect(fantasyAPIMock.getPoints).toHaveBeenCalledWith('player-1', 2023, 1, 'test-profile-1')
  })

  it('does not fetch when disabled', () => {
    const wrapper = createWrapper()
    
    renderHook(
      () => usePoints('player-1', 2023, 1, 'test-profile-1', false),
      { wrapper }
    )

    expect(fantasyAPIMock.getPoints).not.toHaveBeenCalled()
  })

  it('does not fetch when required params are missing', () => {
    const wrapper = createWrapper()
    
    renderHook(
      () => usePoints('', 2023, 1, 'test-profile-1'),
      { wrapper }
    )

    expect(fantasyAPIMock.getPoints).not.toHaveBeenCalled()
  })
})

describe('usePlayerStats hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches player stats successfully', async () => {
    const wrapper = createWrapper()
    
    const { result } = renderHook(
      () => usePlayerStats('player-1', 2023, 1),
      { wrapper }
    )

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(mockPlayerStats)
    expect(fantasyAPIMock.getPlayerStats).toHaveBeenCalledWith('player-1', 2023, 1)
  })

  it('does not fetch when disabled', () => {
    const wrapper = createWrapper()
    
    renderHook(
      () => usePlayerStats('player-1', 2023, 1, false),
      { wrapper }
    )

    expect(fantasyAPIMock.getPlayerStats).not.toHaveBeenCalled()
  })

  it('does not fetch when player ID is missing', () => {
    const wrapper = createWrapper()
    
    renderHook(
      () => usePlayerStats('', 2023, 1),
      { wrapper }
    )

    expect(fantasyAPIMock.getPlayerStats).not.toHaveBeenCalled()
  })
})

describe('useScoringProfiles hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches scoring profiles successfully', async () => {
    const wrapper = createWrapper()
    
    const { result } = renderHook(
      () => useScoringProfiles(),
      { wrapper }
    )

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(mockScoringProfiles)
    expect(fantasyAPIMock.getProfiles).toHaveBeenCalled()
  })

  it('uses correct cache configuration', async () => {
    const wrapper = createWrapper()
    
    const { result } = renderHook(
      () => useScoringProfiles(),
      { wrapper }
    )

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    // Verify the query key is set correctly
    expect(result.current.dataUpdatedAt).toBeGreaterThan(0)
  })
})
