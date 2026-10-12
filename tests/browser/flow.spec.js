import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'

const matlab = readFileSync(new URL('../../server/demo-materials/practicing-answers.m', import.meta.url), 'utf8')

async function post(request, path, data) {
  const response = await request.post('/api' + path, { data })
  expect(response.ok()).toBe(true)
  return response.json()
}

test('teacher creates an assignment and visual question count leaves the interview policy unchanged', async ({ page }) => {
  await page.goto('/#/teacher')
  await page.getByRole('button', { name: 'Create assignment', exact: true }).click()
  const form = page.getByRole('dialog')
  await form.getByLabel('Assignment title').fill('Matlab browser workflow')
  await form.getByLabel('Subject', { exact: true }).fill('Mathematics')
  await form.getByLabel('Instructions', { exact: true }).fill('Solve the MATLAB practice tasks and submit your code.')
  const count = form.getByLabel('Number of questions')
  await expect(count).toHaveValue('adaptive')
  await expect(count.locator('option').first()).toHaveText('Adaptive')
  await count.selectOption('3')
  const createdRequest = page.waitForRequest(request => request.method() === 'POST' && request.url().endsWith('/api/assignments'))
  await form.getByRole('button', { name: 'Create assignment', exact: true }).click()
  expect((await createdRequest).postDataJSON()).not.toHaveProperty('questionLimit')
  await expect(page.getByRole('heading', { name: 'Matlab browser workflow', exact: true })).toBeVisible()
  const assignmentId = page.url().split('/assignment/')[1]
  await page.locator('.assignment-settings > summary').click()
  await expect(page.getByLabel('Number of questions')).toHaveValue('adaptive')
  await page.getByLabel('Interview mode').selectOption('transfer')
  await page.getByLabel('Number of questions').selectOption('6')
  await expect(page.getByLabel('Concepts to test')).toHaveValue('2')
  const savedRequest = page.waitForRequest(request => request.method() === 'PATCH' && request.url().endsWith('/api/assignments/' + assignmentId))
  await page.getByRole('button', { name: 'Save assignment settings' }).click()
  expect((await savedRequest).postDataJSON()).not.toHaveProperty('questionLimit')
  await expect(page.getByText('Settings saved. Existing interviews keep their original mode and timing.')).toBeVisible()
  const assignment = await (await page.request.get('/api/teacher/assignments/' + assignmentId)).json()
  expect(assignment.concept_count).toBe(2)
  expect(assignment.question_limit).toBe(6)
})

test('completed MATLAB attempt opens a compact report with all saved answers and downloads', async ({ page }) => {
  let session = await post(page.request, '/submissions', {
    requestId: crypto.randomUUID(), assignmentId: 'sample-matlab', student: 'Browser report fixture', text: matlab,
  })
  let count = 0
  while (session.status === 'active') {
    expect(count++).toBeLessThan(5)
    await post(page.request, '/sessions/' + session.id + '/present', { questionId: session.question.id })
    session = await post(page.request, '/sessions/' + session.id + '/answers', {
      questionId: session.question.id, transcript: 'I do not know.', method: 'text',
    })
  }
  expect(count).toBe(5)
  await page.goto('/#/teacher')
  await page.getByRole('button', { name: /^Student submissions/ }).click()
  const row = page.locator('.submission-row').filter({ hasText: 'Browser report fixture' })
  await row.getByRole('link', { name: /View report/ }).click()
  await expect(page.getByRole('heading', { name: 'Report', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Assignment grade', exact: true })).toBeVisible()
  await expect(page.locator('.compact-answer')).toHaveCount(2)
  await page.getByRole('button', { name: 'Show more questions', exact: true }).click()
  await expect(page.locator('.compact-answer')).toHaveCount(4)
  const download = page.waitForEvent('download')
  await page.getByRole('link', { name: 'Download PDF', exact: true }).click()
  expect(readFileSync(await (await download).path()).subarray(0, 5).toString()).toBe('%PDF-')
  await page.locator('.report-extra > summary').filter({ hasText: /^Session details$/ }).click()
  await page.getByRole('button', { name: 'Check saved record', exact: true }).click()
  await expect(page.getByText('Checked now: saved record unchanged.', { exact: true })).toBeVisible()
  const recordDownload = page.waitForEvent('download')
  await page.getByRole('link', { name: 'Download record (.txt)', exact: true }).click()
  expect(readFileSync(await (await recordDownload).path(), 'utf8')).toContain('Browser report fixture')
})

test('workspace, assignment cards and upload form fit a phone viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  for (const route of ['/', '/#/teacher', '/#/student']) {
    await page.goto(route)
    await expect(page.locator('h1').first()).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)
  }
  await page.getByRole('button', { name: /Use a sample assignment/ }).click()
  await expect(page.getByLabel('Your name')).toHaveValue('Adnane Essoufi')
})
