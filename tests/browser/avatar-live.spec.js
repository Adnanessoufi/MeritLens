import { test, expect } from '@playwright/test'
import { installFakeCamera, startInterview } from './devices.js'
import { transferWork } from '../../shared/transfer-fixtures.js'

test('live D-ID question plays inside the interview with the actual supplied photo', async ({ page }) => {
  test.skip(process.env.TEST_LIVE_AVATAR !== '1', 'Opt-in provider call uses D-ID/OpenAI credits and the supplied portrait.')
  test.setTimeout(180000)
  await installFakeCamera(page)
  await page.setViewportSize({ width: 1366, height: 768 })
  const base = 'http://127.0.0.1:5175'
  const config = await (await page.request.get(base + '/api/config')).json()
  expect(config.avatarConfigured).toBe(true)
  const response = await page.request.post(base + '/api/submissions', { data: { requestId: crypto.randomUUID(), assignmentId: 'sample-python', student: 'Live avatar UI QA · fictional', text: transferWork.text } })
  expect(response.ok()).toBe(true)
  const session = await response.json()
  await page.goto(base + '/#/session/' + session.id)
  await expect(page.getByText('Talking Adnane is ready', { exact: true })).toBeVisible({ timeout: 140000 })
  await startInterview(page)
  const video = page.getByLabel('Adnane AI talking avatar')
  await expect.poll(() => video.evaluate(v => !v.paused && v.currentTime > .2), { timeout: 10000 }).toBe(true)
  await page.screenshot({ path: '.test-artifacts/screenshots/talking-avatar-live-laptop.png', fullPage: false })
  const getSession = async () => (await (await page.request.get(base + '/api/sessions/' + session.id)).json())
  expect((await getSession()).questionStartedAt).toBeNull()
  await expect.poll(async () => (await getSession()).questionStartedAt, { timeout: 45000 }).not.toBeNull()
  expect(await video.evaluate(v => v.ended)).toBe(true)
  const bounds = await page.getByRole('button', { name: 'Skip Defence', exact: true }).boundingBox()
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(768)
})
