import { test, expect } from '@playwright/test'
import { installFakeCamera, startInterview } from './devices.js'
import { transferWork } from '../../shared/transfer-fixtures.js'

async function prepared(page) {
  await page.addInitScript(() => {
    window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text } }
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { speak(u) { setTimeout(() => u.onend?.(), 25) }, cancel() {} } })
  })
  const response=await page.request.post('/api/assignments', { data: { title: 'Interview preview', subject: 'Computer science', brief: transferWork.brief, concepts: transferWork.concepts, timingMode: 'adaptive' } })
  const assignment=await response.json()
  await page.goto('/#/student/'+assignment.id)
  await page.getByLabel('Your name', { exact: true }).fill('Alex · fictional camera QA')
  await page.getByRole('button', { name: 'Paste text', exact: true }).click()
  await page.getByLabel('Assignment text').fill(transferWork.text)
  await page.getByRole('button', { name: 'Upload & prepare my defence' }).click()
  await expect(page.getByRole('heading', { name: /A conversation/ })).toBeVisible()
 await page.getByLabel('Meeting room',{exact:true}).uncheck()
}

test('camera is required before starting; denied access has an explicit persisted fallback', async ({ page }) => {
  await installFakeCamera(page, 'NotAllowedError')
  await page.setViewportSize({ width: 1366, height: 768 })
  await prepared(page)
  const sessionId=page.url().split('/session/')[1]
  await expect(page.getByRole('button', { name: 'Start oral defence', exact: true })).toBeDisabled()
  await page.screenshot({ path: '.test-artifacts/screenshots/camera-preflight.png', fullPage: false })
  await page.getByRole('button', { name: 'Enable camera', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Camera permission was denied')
  await expect(page.getByRole('button', { name: 'Start oral defence', exact: true })).toBeDisabled()
  await page.getByText('Camera unavailable?', { exact: true }).click()
  await page.getByRole('button', { name: 'Continue without camera', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Start oral defence', exact: true })).toBeEnabled()
  await expect.poll(async () => (await (await page.request.get('/api/sessions/'+sessionId+'/activity')).json()).cameraException).toBe(true)
  await page.getByRole('button', { name: 'Start oral defence', exact: true }).click()
  await expect(page.locator('.interviewer img')).toBeVisible()
  await expect(page.getByText('Camera exception · visible to your teacher', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Resume oral defence', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Resume oral defence', exact: true }).click()
  await page.getByRole('button', { name: 'Skip Defence', exact: true }).click()
  await page.getByRole('button', { name: 'Yes, skip defence', exact: true }).click()
  await page.getByRole('link', { name: /Open report in teacher demo/ }).click()
  await page.getByRole('button', { name: 'Transcript & timing', exact: true }).click()
  await expect(page.getByText('unavailable-camera option used', { exact: true })).toBeVisible()
})

test('camera loss pauses an interview, preserves the draft, reconnects and stops tracks on leaving', async ({ page }) => {
  await installFakeCamera(page)
  await page.setViewportSize({ width: 1366, height: 768 })
  await prepared(page)
  await startInterview(page)
  await expect(page.locator('.camera-active video')).toBeVisible()
  await expect(page.locator('.interviewer')).toHaveAttribute('data-state','ready')
  await page.getByRole('button', { name: 'See Question', exact: true }).click()
  await page.screenshot({ path: '.test-artifacts/screenshots/interviewer-laptop.png', fullPage: false })
  const skipBounds=await page.getByRole('button', { name: 'Skip Defence', exact: true }).boundingBox()
  expect(skipBounds.y+skipBounds.height).toBeLessThanOrEqual(768)
  await page.getByRole('button', { name: 'Can’t speak? Type your answer' }).click()
  await page.getByLabel('Your answer', { exact: true }).fill('My draft stays here while the camera reconnects.')
  await page.evaluate(() => { const track=window.qaCameraStreams.at(-1).getVideoTracks()[0]; track.stop(); track.dispatchEvent(new Event('ended')) })
  await expect(page.getByRole('dialog')).toContainText('Reconnect your camera to continue')
  await expect(page.locator('.interview-layout')).toHaveAttribute('inert','')
  await page.getByRole('dialog').getByRole('button', { name: 'Retry camera', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByLabel('Your answer', { exact: true })).toHaveValue('My draft stays here while the camera reconnects.')
  await expect(page.locator('.camera-active video')).toBeVisible()
  await expect.poll(() => page.locator('.camera-active video').evaluate(node => node.srcObject?.getVideoTracks()[0]?.readyState)).toBe('live')
  await page.getByRole('link', { name: 'Merit Lens home', exact: true }).click()
  await expect.poll(() => page.evaluate(() => window.qaCameraStreams.every(stream => stream.getTracks().every(track => track.readyState==='ended')))).toBe(true)
})


test('a pending camera request cannot overwrite the unavailable-camera choice later', async ({ page }) => {
  await installFakeCamera(page)
  await page.addInitScript(() => {
    const original=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
    Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value: constraints => {
      if (!constraints.video) return original(constraints)
      return new Promise(resolve => { window.qaResolveCamera=async () => resolve(await original(constraints)) })
    }})
  })
  await prepared(page)
  const sessionId=page.url().split('/session/')[1]
  await page.getByRole('button',{name:'Enable camera',exact:true}).click()
  await expect(page.getByRole('button',{name:'Start oral defence',exact:true})).toBeDisabled()
  await page.getByText('Camera unavailable?',{exact:true}).click()
  await page.getByRole('button',{name:'Continue without camera',exact:true}).click()
  await page.getByRole('button',{name:'Start oral defence',exact:true}).click()
  await page.evaluate(() => window.qaResolveCamera())
  await expect.poll(() => page.evaluate(() => window.qaCameraStreams.length)).toBe(1)
  await expect.poll(() => page.evaluate(() => window.qaCameraStreams[0].getVideoTracks()[0].readyState)).toBe('ended')
  await expect(page.getByText('Camera exception · visible to your teacher',{exact:true})).toBeVisible()
  const activity=await (await page.request.get('/api/sessions/'+sessionId+'/activity')).json()
  expect(activity.cameraEnabled).toBe(false)
})
