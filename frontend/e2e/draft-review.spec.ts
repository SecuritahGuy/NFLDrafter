import { expect, test } from '@playwright/test'

test('Draft Review is reachable and handles an empty local ledger', async ({ page }) => {
  await page.goto('/draft-review')

  await expect(page.getByRole('heading', { name: 'No recorded draft yet' })).toBeVisible()
  await expect(page.getByText(/cached completed Yahoo ledger/i)).toBeVisible()
})

test('the primary workflow links remain reachable', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('link', { name: 'Open draft room' }).click()
  await expect(page).toHaveURL(/\/draft-room$/)
  await page.getByRole('link', { name: 'Weekly Prep' }).click()
  await expect(page).toHaveURL(/\/weekly-prep$/)
})

test('a seeded manual draft pick persists and can be undone', async ({ page }) => {
  await page.addInitScript(() => {
    const payload = {
      schema: 'nfldrafter.draft-package', version: 1, generatedAt: '2026-09-02T00:00:00.000Z', season: 2026,
      scoringProfile: { profileId: 'test', name: 'Test PPR', rules: [] },
      league: { leagueSize: 2, draftSlot: 1, rounds: 1 }, rosterSlots: [],
      players: [
        { id: 'alpha', name: 'Alpha Runner', position: 'RB', team: 'CHI', fantasyPoints: 100, yahooPoints: 0, delta: 0, vorp: 10, tier: 1, adp: 1, newsCount: 0, byeWeek: 8, rank: 1 },
        { id: 'bravo', name: 'Bravo Receiver', position: 'WR', team: 'DET', fantasyPoints: 90, yahooPoints: 0, delta: 0, vorp: 8, tier: 1, adp: 2, newsCount: 0, byeWeek: 9, rank: 2 },
      ],
    }
    const input = JSON.stringify(payload)
    let hash = 0x811c9dc5
    for (let index = 0; index < input.length; index += 1) {
      hash ^= input.charCodeAt(index)
      hash = Math.imul(hash, 0x01000193)
    }
    localStorage.setItem('nfldrafter.draft-package.v1', JSON.stringify({ ...payload, checksum: `fnv1a32:${(hash >>> 0).toString(16).padStart(8, '0')}` }))
    if (!localStorage.getItem('nfldrafter.manual-draft.v1')) localStorage.setItem('nfldrafter.manual-draft.v1', JSON.stringify({ version: 1, config: payload.league, picks: [] }))
  })
  await page.goto('/draft-room')
  await page.getByRole('button', { name: 'Open draft tracker' }).click()
  await expect(page.getByRole('heading', { name: 'Manual draft tracker' })).toBeVisible()

  await page.getByRole('button', { name: '1 Alpha Runner RB · CHI · #1' }).click()
  await expect(page.getByText('#1 Alpha Runner', { exact: false })).toBeVisible()

  await page.reload()
  await page.getByRole('button', { name: 'Open draft tracker' }).click()
  await expect(page.getByText('#1 Alpha Runner', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: 'Undo Alpha Runner' }).click()
  await expect(page.getByText('No picks recorded yet. Search above or use a board action to begin.')).toBeVisible()
})
