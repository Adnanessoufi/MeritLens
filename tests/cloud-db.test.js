import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { openDatabase, transaction } from '../server/db.js'
import { installDemoAssignments } from '../server/demo-assignments.js'

test('cloud driver preserves SQL behavior, rollback and records across connections', async t => {
  const directory = mkdtempSync(join(tmpdir(), 'meritlens-cloud-'))
  const cloud = { url: pathToFileURL(join(directory, 'test.sqlite')).href }
  let db = openDatabase(':memory:', cloud)
  t.after(async () => { await db.close(); rmSync(directory, { recursive: true, force: true }) })
  installDemoAssignments(db)
  assert.equal(db.prepare('SELECT COUNT(*) n FROM assignments').get().n, 3)
  const insert = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)')
  assert.throws(() => transaction(db, () => { insert.run('rolled-back', 'value'); throw new Error('Test rollback') }), /Test rollback/)
  assert.equal(db.prepare('SELECT * FROM settings WHERE key=?').get('rolled-back'), undefined)
  transaction(db, () => insert.run('saved', 'Hungarian árvíz'))
  assert.throws(() => insert.run('saved', 'duplicate'), /UNIQUE/)
  await db.close()
  db = openDatabase(':memory:', cloud)
  assert.equal(db.prepare('SELECT value FROM settings WHERE key=?').get('saved').value, 'Hungarian árvíz')
  assert.equal(db.prepare("SELECT json_extract(?, '$.score') n").get('{"score":2}').n, 2)
})


test('a full prepared interview and report work through the hosted database driver', async t => {
  const { createApp } = await import('../server/app.js')
  const { getConfig } = await import('../server/config.js')
  const { readFileSync } = await import('node:fs')
  const { randomUUID } = await import('node:crypto')
  const directory = mkdtempSync(join(tmpdir(), 'meritlens-cloud-flow-'))
  const db = openDatabase(':memory:', { url: pathToFileURL(join(directory, 'test.sqlite')).href })
  installDemoAssignments(db)
  const app = createApp(db, { ...getConfig({ DEMO_MODE: 'true' }), serverless: true })
  const server = app.listen(0, '127.0.0.1')
  await new Promise(resolve => server.once('listening', resolve))
  t.after(async () => { await new Promise(resolve => server.close(resolve)); await db.close(); rmSync(directory, { recursive: true, force: true }) })
  const base = 'http://127.0.0.1:' + server.address().port
  async function post(path, body) {
    const response = await fetch(base + '/api' + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await response.json()
    assert.equal(response.ok, true, JSON.stringify(data))
    return data
  }
  let session = await post('/submissions', { requestId: randomUUID(), assignmentId: 'sample-matlab', student: 'Fictional cloud student', text: readFileSync(new URL('../server/demo-materials/practicing-answers.m', import.meta.url), 'utf8') })
  assert.equal(session.maxQuestions, 5)
  while (session.status === 'active') {
    await post('/sessions/' + session.id + '/present', { questionId: session.question.id })
    session = await post('/sessions/' + session.id + '/answers', { questionId: session.question.id, transcript: 'I do not know.', method: 'text' })
  }
  const report = await (await fetch(base + '/api/reports/' + session.reportId)).json()
  assert.equal(report.answers.length, 5)
  assert.equal(report.student, 'Fictional cloud student')
  assert.equal((await fetch(base + '/api/reports/' + session.reportId + '/download')).headers.get('content-type'), 'application/pdf')
})
