import { test, expect } from '@playwright/test'
import { mkdirSync } from 'node:fs'

test('production showcase visual handoff', async ({ page }) => {
  test.skip(process.env.CAPTURE_LIVE_DEMO !== '1', 'Opt-in visual handoff against the running local demo.')
  await page.goto('http://127.0.0.1:5175/#/showcase')
  await expect(page.getByRole('heading', { name: 'Same polished submission. Different understanding.' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Inspect the evidence', exact: true })).toHaveCount(3)
  await expect(page.getByRole('link', { name: 'See the focused second chance' })).toBeVisible()
  mkdirSync('.test-artifacts/screenshots', { recursive: true })
  await page.screenshot({ path: '.test-artifacts/screenshots/showcase-production.png', fullPage: false })
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)
  await page.screenshot({ path: '.test-artifacts/screenshots/showcase-production-mobile.png', fullPage: false })
})
