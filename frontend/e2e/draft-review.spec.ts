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
