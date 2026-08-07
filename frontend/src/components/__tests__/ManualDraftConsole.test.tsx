import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Player } from '../../types'
import { addDraftPick, createDraftSession } from '../../services/draftEngine'
import { ManualDraftConsole } from '../ManualDraftConsole'

const players: Player[] = [{
  id: 'p1', name: 'First Player', position: 'RB', team: 'CHI', fantasyPoints: 250,
  yahooPoints: 0, delta: 0, vorp: 20, tier: 1, adp: 3, newsCount: 0, byeWeek: 8,
}]

describe('ManualDraftConsole', () => {
  it('shows snake pick context and exposes undo/correction controls', () => {
    const session = addDraftPick(createDraftSession({ leagueSize: 12, draftSlot: 12, rounds: 15 }), 'p1', true)
    const onUndo = vi.fn()
    const onRemovePick = vi.fn()
    render(
      <ManualDraftConsole
        session={session}
        players={players}
        availablePlayers={[]}
        onConfigure={vi.fn()}
        onUndo={onUndo}
        onRemovePick={onRemovePick}
        onReset={vi.fn()}
      />,
    )

    expect(screen.getByText('Pick 2 · Team 2')).toBeInTheDocument()
    expect(screen.getByText('#1 First Player', { exact: false })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove pick 1' }))
    expect(onUndo).toHaveBeenCalledOnce()
    expect(onRemovePick).toHaveBeenCalledWith(1)
  })
})
