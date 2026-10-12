import { randomUUID } from 'node:crypto'
import { writeFileSync, mkdirSync } from 'node:fs'
import assert from 'node:assert/strict'
import { openDatabase, seed } from '../server/db.js'
import { getConfig } from '../server/config.js'
import { createApp } from '../server/app.js'
import { createAI } from '../server/ai.js'
import { sample } from '../tests/helpers.js'

const config = getConfig()
const voiceOnly = process.argv.includes('--voice-only')
if (voiceOnly) config.demo = true
if (!voiceOnly && (config.demo || !config.openaiKey)) throw new Error('Live rehearsal needs this project’s OpenAI configuration and DEMO_MODE=auto or false.')
const db = openDatabase(':memory:')
seed(db)
const server = createApp(db, config).listen(0, '127.0.0.1')
await new Promise(resolve => server.once('listening', resolve))
const base = 'http://127.0.0.1:' + server.address().port
const results = { checkedAt: new Date().toISOString(), syntheticDataOnly: true, model: config.model, stages: [], answers: [] }
async function json(path, body) {
  const response = await fetch(base + '/api' + path, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const data = await response.json()
  if (!response.ok) throw new Error(path + ': ' + (data.error || response.status))
  return data
}
async function stage(name, fn) {
  const started = Date.now()
  const value = await fn()
  results.stages.push({ name, passed: true, seconds: Math.round((Date.now() - started) / 100) / 10 })
  console.log(name + ': passed (' + results.stages.at(-1).seconds + 's)')
  return value
}
try {
  let session = await stage('Real submission analysis', () => json('/submissions', { assignmentId: 'sample-python', student: 'Synthetic QA student', requestId: randomUUID(), text: sample, language: 'en' }))
  const saved = db.prepare('SELECT analysis FROM submissions WHERE id = (SELECT submission_id FROM sessions WHERE id = ?)').get(session.id)
  const analysis = JSON.parse(saved.analysis)
  assert.ok(analysis.concepts.length >= 1)
  if (config.voiceProvider !== 'browser' && (config.elevenKey || config.openaiKey)) {
    const audio = await stage('Provider question audio', async () => {
      const response = await fetch(base + '/api/sessions/' + session.id + '/speech', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ questionId: session.question.id }) })
      if (!response.ok) throw new Error('Question audio: ' + (await response.json()).error)
      const data = await response.arrayBuffer(); assert.ok(data.byteLength > 100); return data
    })
    await stage('Provider generated-audio transcription', async () => {
      const form = new FormData()
      form.append('questionId', session.question.id)
      form.append('audio', new Blob([audio], { type: 'audio/mpeg' }), 'synthetic-question.mp3')
      const response = await fetch(base + '/api/sessions/' + session.id + '/transcribe', { method: 'POST', body: form })
      const data = await response.json()
      if (!response.ok) throw new Error('Transcription: ' + data.error)
      assert.ok(data.text?.length > 10)
    })
  }
  if (!voiceOnly) {
  const ai = createAI(config)
  const dictionary = analysis.concepts.find(c => /dictionar|hash|structure/i.test(c.name)) || analysis.concepts[0]
  const probe = { concept: dictionary.name, text: 'Why did you use a dictionary rather than a list for looking up books by ISBN?' }
  await stage('Understanding calibration with concise reasoning and incorrect keyword-rich answers', async () => {
    const cases = [
      { kind: 'concise-correct', text: 'ISBN uniquely identifies each book. Dictionary lookup averages O(1), whereas finding a book in a list requires O(n) scanning. The dictionary costs more memory.' },
      { kind: 'confident-incorrect', text: 'The dictionary scans every book for every lookup so its average complexity is O(n). A list instead hashes the ISBN and always finds the book in constant time. I chose the dictionary to save memory and make the search faster in all cases, guaranteed.' },
      { kind: 'keywords-only', text: 'Dictionary dictionary ISBN hash testing constant complexity collision search testing memory dictionary ISBN hash constant time.' },
    ]
    results.calibration = []
    for (const item of cases) {
      const evaluation = await ai.evaluate(analysis, probe, item.text, 'live')
      results.calibration.push({ kind: item.kind, ...evaluation })
      if (item.kind === 'concise-correct') assert.equal(evaluation.status, 'DEMONSTRATED')
      else assert.notEqual(evaluation.status, 'DEMONSTRATED', item.kind + ' must not establish understanding')
    }
  })
  await stage('Adaptive live interview and concept report', async () => {
    while (session.status === 'active') {
      assert.ok(results.answers.length < 6)
      const question = session.question
      const transcript = /test|validat|duplicate|error/i.test(question.concept + ' ' + question.text)
        ? 'I checked an empty list, a missing ISBN, and duplicate entries. dictionary.get returns None for a missing key, which lets me show a helpful message. Testing found that a duplicate ISBN overwrote an old book; I now reject duplicates before inserting, and assert the original entry remains unchanged.'
        : 'An ISBN is a unique key, so a dictionary avoids scanning every book. Hashing maps the key to a location, giving average O(1) lookup compared with O(n) for a list. It uses more memory, and collisions can make the worst case slower, so constant time is an average rather than a guarantee.'
      await json('/sessions/' + session.id + '/present', { questionId: question.id })
      session = await json('/sessions/' + session.id + '/answers', { questionId: question.id, transcript, method: 'text' })
      results.answers.push({ concept: question.concept, question: question.text, source: question.source, transcript })
    }
    if (session.status === 'reporting') session = await json('/sessions/' + session.id + '/report', {})
    assert.equal(session.status, 'completed')
    const report = await json('/reports/' + session.reportId)
    assert.ok(report.conceptEvidence.length > 0)
    results.report = { summary: report.summary, conceptEvidence: report.conceptEvidence, strengths: report.strengths, reviewAreas: report.reviewAreas }
  })
  }
  mkdirSync('.test-artifacts', { recursive: true })
  writeFileSync('.test-artifacts/' + (voiceOnly ? 'voice-rehearsal' : 'live-rehearsal') + '.json', JSON.stringify(results, null, 2))
  console.log('Live rehearsal passed. Evidence: .test-artifacts/live-rehearsal.json')
} catch (error) {
  results.error = error.message
  mkdirSync('.test-artifacts', { recursive: true })
  writeFileSync('.test-artifacts/' + (voiceOnly ? 'voice-rehearsal' : 'live-rehearsal') + '.json', JSON.stringify(results, null, 2))
  console.error(error.message)
  process.exitCode = 1
} finally {
  await new Promise(resolve => server.close(resolve))
  db.close()
}
