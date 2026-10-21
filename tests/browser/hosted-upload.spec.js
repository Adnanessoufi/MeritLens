import { test, expect } from '@playwright/test'
import PDFDocument from 'pdfkit'

async function largePdf() {
  return new Promise(resolve => {
    const doc = new PDFDocument({ info: { Subject: 'x'.repeat(5 * 1024 * 1024) } })
    const chunks = []
    doc.on('data', chunk => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.text('A fictional large thesis about checking whether a point is on a curve.')
    doc.end()
  })
}

test('hosted uploads extract a large PDF locally and send only readable text', async ({ page }) => {
  await page.route('**/api/config', async route => {
    const response = await route.fetch()
    await route.fulfill({ json: { ...await response.json(), largePdfClientExtraction: true } })
  })
  let upload
  await page.route('**/api/assignments/prepare', async route => {
    upload = route.request().postDataBuffer()
    await route.fulfill({ json: { title: 'Large PDF example', brief: 'A fictional extracted thesis.', text: 'A fictional large thesis.', concepts: [], rubric: [], filename: 'large.pdf.txt' } })
  })
  await page.goto('/#/teacher')
  await page.getByRole('button', { name: 'Create assignment', exact: true }).click()
  const buffer = await largePdf()
  expect(buffer.length).toBeGreaterThan(4.5 * 1024 * 1024)
  await page.locator('input[type=file][aria-label="Upload assignment"]').setInputFiles({ name: 'large.pdf', mimeType: 'application/pdf', buffer })
  await expect(page.getByLabel('Assignment title')).toHaveValue('Large PDF example', { timeout: 30000 })
  expect(upload.length).toBeLessThan(10000)
  expect(upload.toString()).toContain('A fictional large thesis about checking whether a point is on a curve.')
})
