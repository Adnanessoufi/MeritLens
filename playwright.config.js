import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/browser',
  timeout: 45000,
  workers: 1,
  reporter: 'list',
  outputDir: '.test-artifacts/browser-results',
  use: { baseURL: 'http://127.0.0.1:5184', channel: 'chrome', headless: true, viewport: { width: 1440, height: 1000 }, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: { command: 'node server/index.js', url: 'http://127.0.0.1:5184/api/config', reuseExistingServer: false, timeout: 60000,
    env: { PORT: '5184', HOST: '127.0.0.1', DEMO_MODE: 'true', DATABASE_PATH: ':memory:', OPENAI_API_KEY: '', ELEVENLABS_API_KEY: '' } },
})
