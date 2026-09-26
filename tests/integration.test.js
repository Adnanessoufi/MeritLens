import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { setup, sample, detailedAnswer, pdfFixture, docxFixture } from './helpers.js'
import { createAI } from '../server/ai.js'
import { getConfig } from '../server/config.js'
import { nextQuestion, makeBank } from '../server/flow.js'
import { extractText, HttpError } from '../server/extract.js'
import { openDatabase } from '../server/db.js'
import { mkdirSync } from 'node:fs'

test('complete student defence prefers approved questions and produces a durable evidence report', async t => {
  const app = await setup(t)
  let { status, data: session } = await app.submit()
  assert.equal(status, 201)
  assert.equal(session.question.source, 'teacher-approved')
  assert.equal(session.question.concept, 'Dictionaries')
  const sessionId = session.id
  const questionIds = []
  while (session.status === 'active') {
    questionIds.push(session.question.id)
    const response = await app.answer(session)
    assert.equal(response.status, 200)
    session = response.data
    assert.ok(questionIds.length <= 6)
  }
  assert.ok(session.answered >= 3 && session.answered <= 6)
  assert.equal(session.status, 'completed')
  const { data: report } = await app.request(`/reports/${session.reportId}`)
  assert.equal(report.student, 'Test Student')
  assert.equal(report.mode, 'demo')
  assert.equal(report.answers.length, session.answered)
  assert.ok(new Set(report.answers.map(a => a.concept)).size >= 3)
  assert.ok(report.answers.every(a => a.transcript === detailedAnswer && a.question_started_at && a.response_ended_at))
  assert.match(report.summary, /not an assessment/)
  const replay = await app.request(`/sessions/${sessionId}/answers`, { method: 'POST', body: { questionId: questionIds[0], transcript: detailedAnswer } })
  assert.equal(replay.data.answered, session.answered)
  const { data: submissions } = await app.request('/submissions')
  assert.equal(submissions[0].report_id, session.reportId)
})

test('teacher can create, generate, edit, approve, unapprove, and delete questions', async t => {
  const { request } = await setup(t)
  const { data: assignment, status } = await request('/assignments', { method: 'POST', body: { title: 'Solar energy', subject: 'Science', brief: 'Compare the methods used to store solar energy.', concepts: ['Energy storage', 'Efficiency'] } })
  assert.equal(status, 201)
  await request(`/assignments/${assignment.id}/generate`, { method: 'POST' })
  let details = (await request(`/assignments/${assignment.id}`)).data
  assert.equal(details.questions.length, 2)
  assert.ok(details.questions.every(q => !q.approved))
  const q = details.questions[0]
  await request(`/questions/${q.id}`, { method: 'PATCH', body: { approved: true } })
  const edited = await request(`/questions/${q.id}`, { method: 'PATCH', body: { text: 'What limits energy storage in your proposed system?' } })
  assert.equal(edited.data.approved, false, 'editing requires re-approval')
  await request(`/questions/${q.id}`, { method: 'PATCH', body: { approved: true } })
  await request(`/questions/${q.id}`, { method: 'DELETE' })
  details = (await request(`/assignments/${assignment.id}`)).data
  assert.equal(details.questions.length, 1)
  const own = await request(`/assignments/${assignment.id}/questions`, { method: 'POST', body: { text: 'Why did you select this battery?', concept: 'Energy storage' } })
  assert.equal(own.status, 201)
  await request(`/assignments/${assignment.id}`, { method: 'PATCH', body: { concepts: ['Batteries'] } })
  assert.deepEqual((await request(`/assignments/${assignment.id}`)).data.concepts, ['Batteries'])
})

test('PDF, DOCX, TXT, and pasted text produce real extracted assignment text', async t => {
  const { request } = await setup(t)
  for (const [name, data, type] of [['assignment.pdf', pdfFixture(), 'application/pdf'], ['assignment.docx', docxFixture(), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'], ['assignment.txt', Buffer.from(sample), 'text/plain']]) {
    const form = new FormData()
    form.append('assignmentId', 'sample-python'); form.append('student', 'File Student'); form.append('requestId', randomUUID())
    form.append('file', new Blob([data], { type }), name)
    const result = await request('/submissions', { method: 'POST', body: form })
    assert.equal(result.status, 201, `${name}: ${JSON.stringify(result.data)}`)
    assert.equal(result.data.filename, name)
  }
  const extracted = await extractText(undefined, sample)
  assert.equal(extracted.text, sample)
  assert.match((await extractText({ originalname: 'sample.docx', buffer: docxFixture() })).text, /dictionaries/)
})

test('invalid, empty, unsupported, and oversized assignments are rejected', async t => {
  const { request, submit } = await setup(t)
  assert.equal((await submit({ student: '' })).status, 400)
  assert.equal((await submit({ text: 'Too short.' })).status, 400)
  assert.equal((await submit({ text: 'x'.repeat(60001) })).status, 400)
  await assert.rejects(extractText({ originalname: 'bad.pdf', buffer: Buffer.from('invalid pdf') }), /could not be read/)
  await assert.rejects(extractText({ originalname: 'code.js', buffer: Buffer.from(sample) }), /PDF, DOCX/)
  const form = new FormData()
  form.append('file', new Blob([new Uint8Array(10 * 1024 * 1024 + 1)]), 'large.txt')
  assert.equal((await request('/submissions', { method: 'POST', body: form })).status, 400)
  assert.equal((await request('/assignments', { method: 'POST', headers: { Origin: 'https://untrusted.example' }, body: {} })).status, 403)
})

test('analysis is performed once per idempotent upload and never repeated during answers', async t => {
  const config = getConfig({ DEMO_MODE: 'true' })
  const baseAI = createAI(config)
  let calls = 0
  const ai = { ...baseAI, analyze: async (...args) => { calls++; return baseAI.analyze(...args) } }
  const app = await setup(t, {}, { ai })
  const requestId = randomUUID()
  const first = await app.submit({ requestId })
  const retry = await app.submit({ requestId })
  assert.equal(first.data.id, retry.data.id)
  let session = first.data
  while (session.status === 'active') session = (await app.answer(session)).data
  assert.equal(calls, 1)
})

test('timer starts once, survives reload, records expiry, and excludes evaluation latency', async t => {
  const app = await setup(t)
  const { data: session } = await app.submit()
  assert.equal(session.questionStartedAt, null)
  const start = await app.request(`/sessions/${session.id}/present`, { method: 'POST', body: { questionId: session.question.id } })
  const again = await app.request(`/sessions/${session.id}/present`, { method: 'POST', body: { questionId: session.question.id } })
  assert.equal(start.data.questionStartedAt, again.data.questionStartedAt)
  app.db.prepare('UPDATE sessions SET question_started_at = ?, response_ended_at = ? WHERE id = ?')
    .run(new Date(Date.now() - 80000).toISOString(), new Date(Date.now() - 10000).toISOString(), session.id)
  await app.answer(session)
  const answer = app.db.prepare('SELECT * FROM answers WHERE session_id = ?').get(session.id)
  assert.ok(answer.response_seconds >= 69 && answer.response_seconds <= 71)
  assert.equal(answer.timer_expired, 1)
  assert.equal(answer.status, 'DEMONSTRATED', 'timing is not a quality signal')
})

test('evaluation failures preserve the current question and can be retried', async t => {
  const baseAI = createAI(getConfig({ DEMO_MODE: 'true' }))
  let fail = true
  const ai = { ...baseAI, evaluate: async (...args) => { if (fail) { fail = false; throw new HttpError(502, 'Provider unavailable') } return baseAI.evaluate(...args) } }
  const app = await setup(t, {}, { ai })
  const { data: session } = await app.submit()
  assert.equal((await app.answer(session)).status, 502)
  const saved = (await app.request(`/sessions/${session.id}`)).data
  assert.equal(saved.question.id, session.question.id)
  assert.ok(saved.responseEndedAt)
  const result = await app.answer(saved)
  assert.equal(result.status, 200)
  assert.equal(result.data.answered, 1)
})

test('report failures preserve all answers; generation is retryable and idempotent', async t => {
  const baseAI = createAI(getConfig({ DEMO_MODE: 'true' }))
  let failed = false
  const ai = { ...baseAI, report: async (...args) => { if (!failed) { failed = true; throw new HttpError(502, 'Report unavailable') } return baseAI.report(...args) } }
  const app = await setup(t, {}, { ai })
  let session = (await app.submit()).data
  while (session.status === 'active') session = (await app.answer(session)).data
  assert.equal(session.status, 'reporting')
  assert.ok(session.reportError)
  assert.ok(session.answered >= 3)
  const completed = (await app.request(`/sessions/${session.id}/report`, { method: 'POST' })).data
  assert.equal(completed.status, 'completed')
  const repeat = (await app.request(`/sessions/${session.id}/report`, { method: 'POST' })).data
  assert.equal(repeat.reportId, completed.reportId)
  assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM reports').get().n, 1)
})

test('generic fallback, adaptive branches, and hard six-question limit', async () => {
  const bank = makeBank({ concepts: [], questions: [] }, [])
  assert.equal(bank.length, 3)
  assert.equal(bank[0].source, 'generic')
  const noUsefulConcepts = makeBank({ concepts: [], questions: [] }, [{ text: 'Why a dictionary?', concept: 'Dictionaries' }])
  assert.equal(noUsefulConcepts[0].source, 'generic', 'do not ask unrelated approved questions when extraction found no useful concepts')
  const ai = createAI(getConfig({ DEMO_MODE: 'true' }))
  for (const [answer, expected, phrase] of [[detailedAnswer, 'DEMONSTRATED', 'trade-off'], ['I chose this method to keep the structure of my assignment simple.', 'PARTIAL', 'concrete example'], ['Not sure.', 'UNCLEAR', 'simple terms']]) {
    const result = await ai.evaluate({}, bank[0], answer, 'demo')
    assert.equal(result.status, expected)
    assert.match(result.followUp, new RegExp(phrase))
  }
  const session = { bank, current: bank[0] }
  assert.equal(nextQuestion(session, Array.from({ length: 6 }, () => ({ concept: bank[0].concept })), { followUp: 'Another?' }), null)
  const next = nextQuestion(session, [{ concept: bank[0].concept }], { followUp: 'Explain a trade-off.' })
  assert.equal(next.text, 'Explain a trade-off.')
  assert.equal(next.source, 'adaptive')
})

test('OpenAI request uses structured Responses output and keeps full text out of evaluation', async () => {
  const calls = []
  const outputs = [
    { summary: 'A reading list', concepts: [{ name: 'Dictionaries', evidence: 'stores books in dictionaries', method: 'Hash lookup', claim: 'Average O(1)' }], sections: ['Implementation'], questions: [{ concept: 'Dictionaries', text: 'Why a dictionary?' }] },
    { status: 'PARTIAL', explanation: 'Mentions speed but no trade-off.', followUp: 'What is the memory trade-off?' },
    { summary: 'The student partially explained lookup.', strengths: ['Identified faster lookup.'], reviewAreas: ['Ask about collisions.'] },
  ]
  const ai = createAI({ ...getConfig({ OPENAI_API_KEY: 'test-key', DEMO_MODE: 'false' }) }, async (url, init) => {
    calls.push({ url, ...init, body: JSON.parse(init.body) })
    return new Response(JSON.stringify({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(outputs.shift()) }] }] }), { status: 200 })
  })
  const analysis = await ai.analyze(sample, { title: 'Assignment', brief: 'Explain', concepts: [] })
  await ai.evaluate(analysis, analysis.questions[0], 'It is faster.', 'live')
  await ai.report([{ question: 'Why?', transcript: 'Faster.', status: 'PARTIAL', concept: 'Dictionaries', explanation: 'Limited reasoning.' }], 'live')
  assert.equal(calls.length, 3)
  assert.ok(calls.every(c => c.body.store === false && c.body.text.format.strict === true))
  assert.equal(JSON.parse(calls[0].body.input).submittedText, sample)
  assert.ok(!calls[1].body.input.includes(sample))
  assert.match(calls[1].body.instructions, /Do not use response speed/)
})

test('provider errors and invalid structured output are handled without leaking credentials', async () => {
  for (const request of [async () => new Response('denied', { status: 401 }), async () => new Response(JSON.stringify({ output: [] }), { status: 200 })]) {
    const ai = createAI(getConfig({ OPENAI_API_KEY: 'never-leak-this-key', DEMO_MODE: 'false' }), request)
    await assert.rejects(ai.analyze(sample, { title: 'Test', brief: '', concepts: [] }), error => error.status === 502 && !error.message.includes('never-leak'))
  }
})

test('ElevenLabs speech is cached, transcription is server-side, and keys stay private', async t => {
  let speechCalls = 0
  const provider = async (url, init) => {
    assert.equal(init.headers['xi-api-key'], 'test-eleven-secret')
    if (url.includes('/text-to-speech/')) { speechCalls++; return new Response(Buffer.from('test-audio'), { headers: { 'Content-Type': 'audio/mpeg' } }) }
    assert.ok(init.body instanceof FormData)
    assert.equal(init.body.get('model_id'), 'scribe_v2')
    return new Response(JSON.stringify({ text: 'I used a dictionary for lookups.' }))
  }
  const app = await setup(t, { elevenKey: 'test-eleven-secret' }, { fetch: provider })
  const { data: session } = await app.submit()
  for (let i = 0; i < 2; i++) {
    const response = await fetch(`${app.base}/api/sessions/${session.id}/speech`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ questionId: session.question.id }) })
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'test-audio')
  }
  assert.equal(speechCalls, 1)
  const form = new FormData()
  form.append('questionId', session.question.id)
  form.append('audio', new Blob(['recorded audio'], { type: 'audio/webm' }), 'answer.webm')
  const transcript = await app.request(`/sessions/${session.id}/transcribe`, { method: 'POST', body: form })
  assert.equal(transcript.data.text, 'I used a dictionary for lookups.')
  const config = (await app.request('/config')).data
  assert.equal(config.voice, 'elevenlabs')
  assert.ok(!JSON.stringify(config).includes('test-eleven-secret'))
})

test('SQLite records survive closing and reopening the local database', () => {
  mkdirSync('.test-artifacts', { recursive: true })
  const filename = `.test-artifacts/persistence-${randomUUID()}.sqlite`
  let db = openDatabase(filename)
  db.prepare('INSERT INTO assignments VALUES (?, ?, ?, ?, ?, ?)').run('persist', 'Persisted', 'Test', 'Brief', '[]', new Date().toISOString())
  db.close()
  db = openDatabase(filename)
  assert.equal(db.prepare('SELECT title FROM assignments WHERE id = ?').get('persist').title, 'Persisted')
  db.close()
})
