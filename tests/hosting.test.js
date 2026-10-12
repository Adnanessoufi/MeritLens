import { test } from 'node:test'
import assert from 'node:assert/strict'
import { setup } from './helpers.js'
import { getConfig } from '../server/config.js'
import { configureHosting } from '../server/hosting.js'
import express from 'express'

const auth = password => 'Basic ' + Buffer.from('demo:' + password).toString('base64')

test('hosted demo protects API and page routes while health remains public', async t => {
  const app = await setup(t, { demoAccessPassword: 'test-only-demo-password' })
  for (const path of ['/api/config', '/', '/assets/photo.jpg']) {
    const denied = await fetch(app.base + path)
    assert.equal(denied.status, 401)
    assert.match(denied.headers.get('www-authenticate'), /Merit Lens demo/)
  }
  const health = await fetch(app.base + '/healthz')
  assert.equal(health.status, 200)
  assert.deepEqual(await health.json(), { status: 'ok' })
  assert.equal((await fetch(app.base + '/api/config', { headers: { Authorization: auth('wrong') } })).status, 401)
  assert.equal((await fetch(app.base + '/api/config', { headers: { Authorization: auth('test-only-demo-password') } })).status, 200)
})

test('trusted HTTPS proxy allows same-origin writes and rejects unrelated origins', async t => {
  const app = await setup(t, { trustProxy: true })
  const headers = { 'X-Forwarded-Proto': 'https', Origin: app.base.replace('http:', 'https:') }
  assert.equal((await app.request('/settings/voice', { method: 'POST', headers, body: { provider: 'browser' } })).status, 200)
  assert.equal((await app.request('/settings/voice', { method: 'POST', headers: { ...headers, Origin: 'https://unrelated.example' }, body: { provider: 'browser' } })).status, 403)
})

test('deployment password requirement fails closed without changing local defaults', () => {
  assert.throws(() => configureHosting(express(), {}, { requireDemoAccessPassword: true }), /DEMO_ACCESS_PASSWORD/)
  assert.equal(getConfig({}).requireDemoAccessPassword, false)
  assert.equal(getConfig({}).trustProxy, false)
})
