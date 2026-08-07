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

    expect(screen.getByText('Team 2 · Round 1, pick 2')).toBeInTheDocument()
    expect(screen.getByText('#1 First Player', { exact: false })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Undo First Player' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove pick 1' }))
    expect(onUndo).toHaveBeenCalledOnce()
    expect(onRemovePick).toHaveBeenCalledWith(1)
  })

  it('records a searched player with ownership inferred from snake order', () => {
    const onDraftPlayer = vi.fn()
    render(
      <ManualDraftConsole
        session={createDraftSession({ leagueSize: 12, draftSlot: 1, rounds: 15 })}
        players={players}
        availablePlayers={players}
        onConfigure={vi.fn()}
        onUndo={vi.fn()}
        onRemovePick={vi.fn()}
        onReset={vi.fn()}
        onDraftPlayer={onDraftPlayer}
      />,
    )

    fireEvent.change(screen.getByPlaceholderText('Type a player, team, or position…'), { target: { value: 'First' } })
    fireEvent.click(screen.getByRole('button', { name: /First Player/ }))
    expect(onDraftPlayer).toHaveBeenCalledWith('p1', true)
  })
})
