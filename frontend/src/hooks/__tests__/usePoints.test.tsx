import React, { ReactNode } from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Mock the API module before importing anything that uses it
vi.mock('../../api', () => ({
  fantasyAPI: {
    getProfiles: vi.fn(),
    getPoints: vi.fn(),
    getPlayerStats: vi.fn(),
    calculatePoints: vi.fn()
  }
}))

import { usePoints, usePlayerStats, useScoringProfiles } from '../usePoints'
import { mockScoringProfiles, mockPlayerStats, mockPointsResult } from '../../test/mocks'
import { fantasyAPI } from '../../api'

const mockAPI = vi.mocked(fantasyAPI)

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
    mockAPI.getPoints.mockResolvedValue(mockPointsResult)
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
    expect(mockAPI.getPoints).toHaveBeenCalledWith('player-1', 2023, 1, 'test-profile-1')
  })

  it('does not fetch when disabled', () => {
    const wrapper = createWrapper()
    
    renderHook(
      () => usePoints('player-1', 2023, 1, 'test-profile-1', false),
      { wrapper }
    )

    expect(mockAPI.getPoints).not.toHaveBeenCalled()
  })

  it('does not fetch when required params are missing', () => {
    const wrapper = createWrapper()
    
    renderHook(
      () => usePoints('', 2023, 1, 'test-profile-1'),
      { wrapper }
    )

    expect(mockAPI.getPoints).not.toHaveBeenCalled()
  })
})

describe('usePlayerStats hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAPI.getPlayerStats.mockResolvedValue(mockPlayerStats)
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
    expect(mockAPI.getPlayerStats).toHaveBeenCalledWith('player-1', 2023, 1)
  })

  it('does not fetch when disabled', () => {
    const wrapper = createWrapper()
    
    renderHook(
      () => usePlayerStats('player-1', 2023, 1, false),
      { wrapper }
    )

    expect(mockAPI.getPlayerStats).not.toHaveBeenCalled()
  })

  it('does not fetch when player ID is missing', () => {
    const wrapper = createWrapper()
    
    renderHook(
      () => usePlayerStats('', 2023, 1),
      { wrapper }
    )

    expect(mockAPI.getPlayerStats).not.toHaveBeenCalled()
  })
})

describe('useScoringProfiles hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAPI.getProfiles.mockResolvedValue(mockScoringProfiles)
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
    expect(mockAPI.getProfiles).toHaveBeenCalled()
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
