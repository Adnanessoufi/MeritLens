import { expect } from '@playwright/test'

export async function installFakeCamera(page, failure = '') {
  await page.addInitScript(failure => {
    const devices = navigator.mediaDevices || {}
    if (!navigator.mediaDevices) Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: devices })
    const original = devices.getUserMedia?.bind(devices)
    window.qaCameraStreams = []
    Object.defineProperty(devices, 'getUserMedia', { configurable: true, value: async constraints => {
      if (!constraints.video) return original?.(constraints)
      if (failure) throw new DOMException('Synthetic camera failure', failure)
      const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 480
      const ctx = canvas.getContext('2d'); ctx.fillStyle = '#D2E3D9'; ctx.fillRect(0,0,640,480)
      ctx.fillStyle = '#315E4B'; ctx.font = '28px sans-serif'; ctx.fillText('Synthetic camera · test only', 100,245)
      const stream = canvas.captureStream(2)
      window.qaCameraStreams.push(stream)
      return stream
    } })
  }, failure)
}

export async function startInterview(page, name = 'Start oral defence') {
  const mode=page.getByLabel('Meeting room',{exact:true}); await expect(mode).toBeVisible(); await mode.uncheck()
  await page.locator('.camera-setup-copy > .button').click()
  await expect(page.locator('.camera-active video')).toBeVisible()
  await page.getByRole('button', { name, exact: true }).click()
}
