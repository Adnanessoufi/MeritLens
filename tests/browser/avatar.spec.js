import { test, expect } from '@playwright/test'
import { installFakeCamera, startInterview } from './devices.js'
import { transferWork } from '../../shared/transfer-fixtures.js'

async function setupAvatar(page, ready = false) {
  await installFakeCamera(page)
  await page.addInitScript(() => {
    window.avatarReady = false
    window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text } }
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { speak(u) { setTimeout(() => u.onend?.(), 25) }, cancel() {} } })
  })
  await page.route('**/api/config', async route => {
    const response = await route.fetch()
    await route.fulfill({ json: { ...await response.json(), avatarConfigured: true, avatarProvider: 'd-id' } })
  })
  const starts = []
  await page.route('**/api/sessions/*/avatar*', async route => {
    if (route.request().method() === 'POST') starts.push(route.request().postDataJSON().questionId)
    const available = ready || await page.evaluate(() => window.avatarReady)
    await route.fulfill({ json: available ? { status: 'ready', videoUrl: await page.evaluate(() => window.avatarFixtureUrl) } : { status: 'rendering' } })
  })
  await page.goto('/')
  // Actual browser media decoding/playback; synthetic clip stands in for a provider output.
  const bytes = await page.evaluate(async () => {
    const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 320
    const context = canvas.getContext('2d'); context.fillStyle = '#37775c'; context.fillRect(0, 0, 320, 320)
    context.fillStyle = 'white'; context.font = '22px sans-serif'; context.fillText('Synthetic avatar QA', 35, 160)
    const stream = canvas.captureStream(10)
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' })
    const chunks = []
    return new Promise(resolve => {
      recorder.ondataavailable = event => chunks.push(event.data)
      recorder.onstop = async () => { stream.getTracks().forEach(track => track.stop()); resolve([...new Uint8Array(await new Blob(chunks).arrayBuffer())]) }
      recorder.start()
      const tick = setInterval(() => { context.fillStyle = '#' + Math.floor(Math.random()*0xffffff).toString(16).padStart(6,'0'); context.fillRect(0, 0, 10, 10) }, 100)
      setTimeout(() => { clearInterval(tick); recorder.stop() }, 2200)
    })
  })
  expect(bytes.length).toBeGreaterThan(1000)
  await page.evaluate(bytes => { window.avatarFixtureUrl = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'video/webm' })) }, bytes)
  await page.addInitScript(bytes => { window.avatarFixtureUrl = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'video/webm' })) }, bytes)
  const assignment = await (await page.request.post('/api/assignments', { data: { title: 'Talking avatar QA', subject: 'Computer science', brief: transferWork.brief, concepts: transferWork.concepts, timingMode: 'adaptive' } })).json()
  const session = await (await page.request.post('/api/submissions', { data: { requestId: crypto.randomUUID(), assignmentId: assignment.id, student: 'Alex · fictional avatar QA', text: transferWork.text } })).json()
  await page.goto('/#/session/' + session.id)
  await expect(page.getByRole('heading', { name: /A conversation/ })).toBeVisible()
 await page.getByLabel('Meeting room',{exact:true}).uncheck()
  return { session, starts }
}

test('talking question plays a real video; timer waits for its end; replay reuses the clip', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 })
  const { session, starts } = await setupAvatar(page, true)
  await expect(page.getByText('Talking Adnane is ready', { exact: true })).toBeVisible()
  await startInterview(page)
  const video = page.getByLabel('Adnane AI talking avatar')
  await expect(video).toBeVisible()
  await expect.poll(() => video.evaluate(v => !v.paused && v.currentTime > 0)).toBe(true)
  const getSession = async () => (await (await page.request.get('/api/sessions/' + session.id)).json())
  expect((await getSession()).questionStartedAt).toBeNull()
  await page.screenshot({ path: '.test-artifacts/screenshots/talking-avatar-laptop-qa.png', fullPage: false })
  await expect.poll(async () => (await getSession()).questionStartedAt).not.toBeNull()
  const started = (await getSession()).questionStartedAt
  await page.getByRole('button', { name: 'Listen Again', exact: true }).click()
  await expect.poll(() => video.evaluate(v => !v.paused && v.currentTime < 2)).toBe(true)
  await expect(page.locator('.interviewer')).toHaveAttribute('data-state', 'ready')
  expect((await getSession()).questionStartedAt).toBe(started)
  expect(starts).toEqual([session.question.id])
  const skip = await page.getByRole('button', { name: 'Skip Defence', exact: true }).boundingBox()
  expect(skip.y + skip.height).toBeLessThanOrEqual(768)
})

test('revealing a delayed question prevents late video playback; voice-only is scoped to its question', async ({ page }) => {
  const { session } = await setupAvatar(page)
  await startInterview(page)
  await expect(page.getByRole('button', { name: 'Listen Again', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'See Question', exact: true }).click()
  await page.evaluate(() => { window.avatarReady = true })
  const video = page.getByLabel('Adnane AI talking avatar')
  await expect(video).toHaveCount(1)
  expect(await video.evaluate(v => v.paused)).toBe(true)
  await page.getByRole('button', { name: 'Use voice only', exact: true }).click()
  await expect(video).toHaveCount(0)
  await page.getByRole('button', { name: 'Can’t speak? Type your answer' }).click()
  await page.getByLabel('Your answer', { exact: true }).fill('The ISBN key avoids scanning every book; I chose average constant time lookup with a memory trade-off.')
  await page.evaluate(() => { window.avatarReady = false })
  await page.getByRole('button', { name: 'Send answer', exact: true }).click()
  await expect(page.locator('.interviewer')).toHaveAttribute('data-state', 'preparing')
  await expect(page.getByRole('button', { name: 'Continue with voice only', exact: true })).toBeVisible()
  const current = await (await page.request.get('/api/sessions/' + session.id)).json()
  expect(current.question.id).not.toBe(session.question.id)
  expect(current.questionStartedAt).toBeNull()
  await page.getByRole('button', { name: 'Continue with voice only', exact: true }).click()
  await expect.poll(async () => (await (await page.request.get('/api/sessions/' + session.id)).json()).questionStartedAt).not.toBeNull()
})
