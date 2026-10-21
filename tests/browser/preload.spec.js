import {test,expect} from '@playwright/test'

test('workspace forms appear while config loads and homepage preloads shared data once', async ({page}) => {
  let release
  const gate = new Promise(resolve => { release = resolve })
  let assignmentRequests = 0
  page.on('request', request => { if (new URL(request.url()).pathname === '/api/assignments') assignmentRequests++ })
  await page.route('**/api/config', async route => { await gate; await route.continue() })
  await page.goto('/')
  await expect(page.getByRole('heading', {name:'Choose your workspace'})).toBeVisible()
  await expect.poll(() => assignmentRequests).toBe(1)
  await page.getByRole('link', {name:'Student workspace'}).click()
  await expect(page.getByRole('heading', {name:'Upload your work'})).toBeVisible()
  await expect(page.getByLabel('Your name')).toBeVisible()
  release()
  await expect(page.getByRole('combobox', {name:'Assignment',exact:true}).locator('option')).toHaveCount(4)
  expect(assignmentRequests).toBe(1)
  await page.goto('/#/teacher')
  await expect(page.getByRole('heading', {name:'Your assignments'})).toBeVisible()
})
