import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'

test('compare actual portrait with standard and neutral stitched animations', async ({ page }) => {
  test.skip(process.env.TEST_AVATAR_COMPARISON !== '1', 'Local visual comparison; needs the two saved provider clips.')
  await page.setViewportSize({ width: 1366, height: 768 })
  for (const [url,file] of [['before','.test-artifacts/talking-avatar-new-photo.mp4'],['after','.test-artifacts/talking-avatar-natural-test.mp4']]) {
    await page.route('**/quality-'+url+'.mp4', route => route.fulfill({ contentType: 'video/mp4', body: readFileSync(file) }))
  }
  await page.goto('/')
  await page.setContent('<style>body{font:18px Arial;background:#f1f5f2;color:#193e30;padding:28px}h1{font-size:25px}main{display:flex;gap:24px}figure{margin:0;width:380px}img,video{width:380px;height:380px;object-fit:contain;background:#ddd}figcaption{padding:10px 0;font-weight:bold}</style><h1>Adnane · likeness comparison</h1><main><figure><img src="http://127.0.0.1:5184/assets/adnane-interviewer.jpg"><figcaption>Original photo</figcaption></figure><figure><video src="http://127.0.0.1:5184/quality-before.mp4" muted preload="auto"></video><figcaption>Current animation</figcaption></figure><figure><video src="http://127.0.0.1:5184/quality-after.mp4" muted preload="auto"></video><figcaption>Test: original-image stitching + neutral expression</figcaption></figure></main>')
  for(const video of await page.locator('video').all()) {
    await expect.poll(() => video.evaluate(v => v.readyState)).toBeGreaterThanOrEqual(2)
    await video.evaluate(v => new Promise(resolve => { v.addEventListener('seeked',resolve,{once:true}); v.currentTime=2 }))
  }
  await page.screenshot({path:'.test-artifacts/screenshots/avatar-likeness-comparison.png',fullPage:false})
})
