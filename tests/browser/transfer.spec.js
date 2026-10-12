import { test, expect } from '@playwright/test'
import { installFakeCamera, startInterview } from './devices.js'
test.beforeEach(async ({ page }) => { await installFakeCamera(page) })
import { transferWork, transferProfiles } from '../../shared/transfer-fixtures.js'

test('live transfer feature completes two ordered pairs and displays the paired report', async ({ page }) => {
  test.skip(process.env.TEST_LIVE_TRANSFER !== '1', 'Opt-in live test uses this project’s configured provider and fictional data.')
  test.setTimeout(180000)
  const errors = []; page.on('pageerror', error => errors.push(error.message))
  await page.route('**/api/config', async route => { const response = await route.fetch(); const config = await response.json(); await route.fulfill({ json: { ...config, voice: 'browser', avatarConfigured: false } }) })
  await page.addInitScript(() => {
    window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text } }
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { speak(utterance) { setTimeout(() => utterance.onend?.(), 30) }, cancel() {} } })
  })
  await page.goto('http://127.0.0.1:5175/#/transfer')
  await expect(page.getByRole('heading', { name: /Beyond the explanation/ })).toBeVisible()
  await expect(page.locator('.transfer-example')).toHaveCount(3)
  const measured = await (await page.request.get('http://127.0.0.1:5175/api/transfer/demo')).json();
  expect(measured.validation.total).toBe(13);
  await expect(page.locator('.validation-metrics')).toContainText(measured.validation.agreement + '/' + measured.validation.total)
  await page.screenshot({ path: '.test-artifacts/screenshots/transfer-feature.png', fullPage: false })
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('http://127.0.0.1:5175/#/student/transfer-python/transfer')
  await page.getByLabel('Your name', { exact: true }).fill('Live transfer UI QA · fictional')
  await page.getByLabel('Concept pairs').selectOption('2')
  await page.getByRole('button', { name: 'Paste text', exact: true }).click()
  await page.getByLabel('Assignment text').fill(transferWork.text)
  await page.getByRole('button', { name: 'Upload & prepare my defence' }).click()
  await startInterview(page)
  const sessionId = page.url().split('/session/')[1]
  let count = 0
  while (page.url().includes('/session/')) {
    const session = await (await page.request.get('http://127.0.0.1:5175/api/sessions/' + sessionId)).json()
    expect(session.question.stage).toBe(count % 2 ? 'apply' : 'explain')
    expect(session.maxQuestions).toBe(4)
    expect(session.question.pairSpec).toBeUndefined()
    expect(session.question.expectedTransfer).toBeUndefined()
    await expect(page.locator('.transfer-stage')).toContainText(count % 2 ? 'Apply the idea under a change' : 'Explain the original choice')
    await page.getByRole('button', { name: 'See Question', exact: true }).click()
    await page.getByRole('button', { name: 'Can’t speak? Type your answer' }).click()
    const conceptIndex = transferWork.concepts.indexOf(session.question.concept)
    const text = transferProfiles[0].originals[Math.max(0, conceptIndex)]
    await page.getByLabel('Your answer', { exact: true }).fill(text)
    await page.getByRole('button', { name: 'Send answer' }).click()
    count++
    await page.waitForFunction(next => location.hash.startsWith('#/complete/') || document.querySelector('.question-counter')?.textContent.includes('Question ' + next), count + 1)
  }
  expect(count).toBe(4)
  await page.getByRole('link', { name: /Open report in teacher demo/ }).click()
  await expect(page.locator('.transfer-pair')).toHaveCount(2)
  await expect(page.locator('.transfer-metrics')).toContainText('Reasoning consistency')
  await page.screenshot({ path: '.test-artifacts/screenshots/transfer-live-report.png', fullPage: false })
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)
  expect(errors).toEqual([])
})
