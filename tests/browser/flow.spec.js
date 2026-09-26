import { test, expect } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const answer = 'I chose a dictionary because every book has a unique ISBN key. Looking up the key avoids scanning every entry in a list and is constant time on average. A trade-off is extra memory and possible hash collisions, so the worst case can still be slow.'
const shots = '.test-artifacts/screenshots'
mkdirSync(shots, { recursive: true })

async function fakeSpeech(page) {
  // Browser audio is not available in headless tests. Exercise UI callbacks without microphone access.
  await page.addInitScript(() => {
    class Utterance { constructor(text) { this.text = text } }
    window.SpeechSynthesisUtterance = Utterance
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
      speak(utterance) { setTimeout(() => { utterance.onstart?.(); setTimeout(() => utterance.onend?.(), 40) }, 20) },
      cancel() {},
    } })
  })
}

test('student completes an adaptive defence and teacher opens saved evidence', async ({ page }) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await fakeSpeech(page)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /Good work deserves/ })).toBeVisible()
  await page.screenshot({ path: `${shots}/landing-desktop.png`, fullPage: true })
  await page.getByRole('link', { name: 'I’m a student' }).click()
  await page.getByRole('button', { name: /Use a sample assignment/ }).click()
  await expect(page.getByLabel('Your name')).toHaveValue('Alex Morgan')
  await page.screenshot({ path: `${shots}/upload-desktop.png`, fullPage: true })
  await page.getByRole('button', { name: 'Upload & prepare my defence' }).click()
  await expect(page.getByRole('heading', { name: /A conversation/ })).toBeVisible()
  await page.getByRole('button', { name: 'Start oral defence' }).click()
  await expect(page.getByRole('heading', { name: 'Your turn to share.' })).toBeVisible()
  await expect(page.getByText('Why did you store your books in a dictionary instead of a list?', { exact: true })).not.toBeVisible()
  await expect(page.getByRole('textbox')).toHaveCount(0)
  await page.screenshot({ path: `${shots}/defence-desktop.png`, fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: `${shots}/defence-mobile.png`, fullPage: true })
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 390)
  await page.setViewportSize({ width: 1440, height: 1000 })
  let questionCount = 0
  while (page.url().includes('/session/')) {
    questionCount++
    expect(questionCount).toBeLessThanOrEqual(6)
    await page.getByRole('button', { name: 'See Question', exact: true }).click()
    await expect(page.locator('.revealed-question')).toBeVisible()
    await page.getByRole('button', { name: 'Can’t speak? Type your answer' }).click()
    await page.getByLabel('Your answer', { exact: true }).fill(answer)
    await page.getByRole('button', { name: 'Send answer' }).click()
    await page.waitForFunction(next => location.hash.startsWith('#/complete/') || document.querySelector('.question-counter')?.textContent.includes(`Question ${next}`), questionCount + 1)
  }
  expect(questionCount).toBeGreaterThanOrEqual(3)
  await expect(page.getByRole('heading', { name: /Oral defence completed/ })).toBeVisible()
  await page.screenshot({ path: `${shots}/completion-desktop.png`, fullPage: true })
  await page.getByRole('link', { name: /Open report in teacher demo/ }).click()
  await expect(page.getByRole('heading', { name: 'Understanding Evidence Matrix' })).toBeVisible()
  await expect(page.getByText('Demo evidence · illustrative only')).toBeVisible()
  await expect(page.locator('tbody tr')).toHaveCount(questionCount)
  await expect(page.locator('.transcript-body blockquote').first()).toHaveText(answer)
  await page.screenshot({ path: `${shots}/report-desktop.png`, fullPage: true })
  await page.reload()
  await expect(page.locator('tbody tr')).toHaveCount(questionCount)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: `${shots}/report-mobile.png`, fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)
  expect(errors).toEqual([])
})

test('teacher creates assignment and reviews, edits, approves, and deletes questions', async ({ page }) => {
  await page.goto('/#/teacher')
  await expect(page.getByRole('heading', { name: /See the thinking/ })).toBeVisible()
  await page.screenshot({ path: `${shots}/teacher-desktop.png`, fullPage: true })
  await page.getByRole('button', { name: 'Create assignment', exact: true }).click()
  await page.getByLabel('Assignment title').fill('Urban gardens research')
  await page.getByLabel('Subject', { exact: true }).fill('Environmental science')
  await page.getByLabel('Assignment brief').fill('Explain the benefits and limits of community gardens in urban areas.')
  await page.getByLabel(/Core concepts/).fill('Biodiversity, Water use, Community')
  await page.getByRole('dialog').getByRole('button', { name: 'Create assignment', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Urban gardens research' })).toBeVisible()
  await page.getByRole('button', { name: 'Suggest demo questions' }).click()
  await expect(page.locator('.question-editor')).toHaveCount(3)
  await page.locator('.question-editor').first().getByRole('button', { name: 'Approve', exact: true }).click()
  await expect(page.locator('.question-editor').first().getByText('Approved', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Edit question 1', exact: true }).click()
  await page.locator('.question-editor').first().getByRole('textbox', { name: 'Question', exact: true }).fill('How did your garden design support biodiversity?')
  await page.getByRole('button', { name: 'Save for review' }).click()
  await expect(page.locator('.question-editor').first().getByText('Review needed')).toBeVisible()
  await page.locator('.question-editor').first().getByRole('button', { name: 'Approve', exact: true }).click()
  await page.getByRole('button', { name: 'Delete question 3', exact: true }).click()
  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(page.locator('.question-editor')).toHaveCount(2)
  await page.getByRole('button', { name: 'Add your own question' }).click()
  await page.locator('.add-question-form').getByLabel('Concept', { exact: true }).fill('Water use')
  await page.locator('.add-question-form').getByLabel('Question', { exact: true }).fill('How did you reduce water consumption?')
  await page.getByRole('button', { name: 'Add & approve' }).click()
  await expect(page.locator('.question-editor')).toHaveCount(3)
  await page.getByRole('button', { name: 'Share student link' }).click()
  await expect(page.getByLabel('Student session link')).toHaveValue(/\/student\//)
  await page.screenshot({ path: `${shots}/questions-desktop.png`, fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: `${shots}/questions-mobile.png`, fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)
})

test('mobile layouts fit and microphone denial preserves the text fallback', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 })
  await fakeSpeech(page)
  await page.addInitScript(() => {
    class Recognition {
      start() { setTimeout(() => { this.onerror?.({ error: 'not-allowed' }); this.onend?.() }, 30) }
      stop() { this.onend?.() }
      abort() {}
    }
    window.SpeechRecognition = Recognition
  })
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'I’m a student' })).toBeVisible()
  await page.screenshot({ path: `${shots}/landing-mobile.png`, fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360)
  await page.getByRole('link', { name: 'I’m a student' }).click()
  await page.screenshot({ path: `${shots}/upload-mobile.png`, fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360)
  await page.getByRole('button', { name: /Use a sample assignment/ }).click()
  await page.getByRole('button', { name: 'Upload & prepare my defence' }).click()
  await page.getByRole('button', { name: 'Start oral defence' }).click()
  await page.getByRole('button', { name: 'Record answer', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Microphone access was denied')
  await page.getByRole('button', { name: 'Can’t speak? Type your answer' }).click()
  await expect(page.getByLabel('Your answer', { exact: true })).toBeVisible()
  await page.getByLabel('Your answer', { exact: true }).fill('I am using the text fallback to explain my approach.')
  await page.getByRole('button', { name: 'Send answer' }).click()
  await expect(page.locator('.question-counter')).toContainText('Question 2')
  await page.reload()
  await page.getByRole('button', { name: 'Resume oral defence' }).click()
  await expect(page.locator('.question-counter')).toContainText('Question 2')
})

test('blocked audio can be revealed and a spoken transcript advances the conversation', async ({ page }) => {
  await page.addInitScript(transcript => {
    window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text } }
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { speak() {}, cancel() {} } })
    window.SpeechRecognition = class {
      start() { setTimeout(() => this.onresult?.({ results: [[{ transcript }]] }), 40) }
      stop() { this.onend?.() }
      abort() {}
    }
  }, answer)
  await page.goto('/#/student')
  await page.getByRole('button', { name: /Use a sample assignment/ }).click()
  await page.getByRole('button', { name: 'Upload & prepare my defence' }).click()
  await page.getByRole('button', { name: 'Start oral defence' }).click()
  await expect(page.getByRole('button', { name: 'Record answer', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'See Question', exact: true }).click()
  await page.getByRole('button', { name: 'Record answer', exact: true }).click()
  await expect(page.getByRole('textbox', { name: /Your transcript/ })).toHaveValue(answer)
  await page.getByRole('button', { name: 'Stop recording', exact: true }).click()
  await page.getByRole('button', { name: 'Send answer' }).click()
  await expect(page.locator('.question-counter')).toContainText('Question 2')
  await expect(page.locator('.revealed-question')).toHaveCount(0)
  const id = page.url().split('/session/')[1]
  const data = await page.request.get(`/api/sessions/${id}`)
  expect((await data.json()).answered).toBe(1)
})
