import { test } from 'node:test'
import assert from 'node:assert/strict'
import { setup } from './helpers.js'

async function untilReady(app, path) {
  for (let i = 0; i < 15; i++) {
    const value = await app.request(path)
    if (['ready', 'error'].includes(value.data.status)) return value
    await new Promise(resolve => setTimeout(resolve, 20))
  }
  throw Error('Job did not settle')
}

test('local avatar is enabled without a key; legacy D-ID endpoint remains disabled and gates hidden questions', async t => {
  let calls = 0
  const app = await setup(t, {}, { fetch: async () => { calls++; throw Error('Unexpected request') } })
  const { data: session } = await app.submit()
  const path = '/sessions/' + session.id + '/avatar'
  assert.equal((await app.request('/config')).data.avatarConfigured, true)
  assert.equal((await app.request('/config')).data.avatarProvider, 'local-mouth')
  assert.equal((await app.request(path, { method: 'POST', body: { questionId: session.question.id } })).data.status, 'disabled')
  assert.equal((await app.request(path, { method: 'POST', body: { questionId: 'future', text: 'arbitrary injected text' } })).status, 409)
  assert.equal(calls, 0)
})

test('avatar shares question audio, uploads only the supplied portrait, coalesces retries, and gates the timer', async t => {
  const calls = []
  let script
  const app = await setup(t, { didKey: 'server-secret', openaiKey: 'audio-secret', voiceProvider: 'openai' }, { fetch: async (url, options) => {
    calls.push(url)
    if (url.includes('openai.com')) return new Response(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'audio/mpeg' } })
    assert.equal(options.headers.Authorization, 'Basic server-secret')
    if (url.endsWith('/images')) { assert.ok(options.body.get('image').size > 10000); return Response.json({ url: 'https://assets.d-id.com/adnane.png' }) }
    if (url.endsWith('/audios')) { assert.equal(options.body.get('audio').size, 3); return Response.json({ url: 'https://assets.d-id.com/question.wav' }) }
    if (url.endsWith('/talks')) { script = JSON.parse(options.body); return Response.json({ id: 'tlk_mock' }) }
    return Response.json({ status: 'done', result_url: 'https://result.d-id.com/mock.mp4' })
  } })
  const { data: session } = await app.submit()
  const path = '/sessions/' + session.id + '/avatar'
  const start = () => app.request(path, { method: 'POST', body: { questionId: session.question.id } })
  await Promise.all([start(), start(), start()])
  const ready = await untilReady(app, path + '?questionId=' + session.question.id)
  assert.equal(ready.data.status, 'ready')
  assert.equal(script.script.type, 'audio')
  assert.equal(script.script.audio_url, 'https://assets.d-id.com/question.wav')
  assert.ok(!JSON.stringify(script).includes('Test Student'))
  assert.equal(calls.filter(url => url.endsWith('/talks')).length, 1)
  assert.equal(calls.filter(url => url.includes('openai.com')).length, 1)
  await fetch(app.base + '/api/sessions/' + session.id + '/speech', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ questionId: session.question.id }) })
  assert.equal(calls.filter(url => url.includes('openai.com')).length, 1)
  assert.equal((await app.request('/sessions/' + session.id)).data.questionStartedAt, null)
  const config = (await app.request('/config')).data
  assert.equal(config.avatarConfigured, true)
  assert.ok(!JSON.stringify(config).includes('server-secret'))
  const next = (await app.answer(session)).data
  assert.notEqual(next.question.id, session.question.id)
  assert.equal((await app.request(path + '?questionId=' + session.question.id)).status, 409)
})

test('rejected credentials return a clear avatar error and do not retry automatically', async t => {
  let calls = 0
  const app = await setup(t, { didKey: 'invalid', openaiKey: 'audio-secret', voiceProvider: 'openai' }, { fetch: async () => { calls++; return new Response('', { status: 401 }) } })
  const { data: session } = await app.submit()
  const path = '/sessions/' + session.id + '/avatar'
  await app.request(path, { method: 'POST', body: { questionId: session.question.id } })
  const result = await untilReady(app, path + '?questionId=' + session.question.id)
  assert.equal(result.data.status, 'error')
  assert.match(result.data.error, /key was rejected/)
  await app.request(path, { method: 'POST', body: { questionId: session.question.id } })
  assert.equal(calls, 1)
  assert.equal((await app.request('/sessions/' + session.id)).data.questionStartedAt, null)
})

test('retry after a polling failure resumes the same paid talk rather than regenerating it', async t => {
  let renders = 0, polls = 0
  const app = await setup(t, { didKey: 'server-secret', openaiKey: 'audio-secret', voiceProvider: 'openai' }, { fetch: async url => {
    if (url.includes('openai.com')) return new Response(new Uint8Array([1, 2, 3]))
    if (url.endsWith('/images')) return Response.json({ url: 'https://assets.d-id.com/adnane.png' })
    if (url.endsWith('/audios')) return Response.json({ url: 'https://assets.d-id.com/question.wav' })
    if (url.endsWith('/talks')) { renders++; return Response.json({ id: 'tlk_retry' }) }
    polls++
    if (polls === 1) return new Response('', { status: 502 })
    return Response.json({ status: 'done', result_url: 'https://result.d-id.com/retry.mp4' })
  } })
  const { data: session } = await app.submit()
  const path = '/sessions/' + session.id + '/avatar'
  await app.request(path, { method: 'POST', body: { questionId: session.question.id } })
  assert.equal((await untilReady(app, path + '?questionId=' + session.question.id)).data.status, 'error')
  await app.request(path, { method: 'POST', body: { questionId: session.question.id, retry: true } })
  assert.equal((await untilReady(app, path + '?questionId=' + session.question.id)).data.status, 'ready')
  assert.equal(renders, 1)
})
