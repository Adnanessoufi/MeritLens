import express from 'express'
import multer from 'multer'
import { id, now, transaction } from './db.js'
import { extractText, requiredText, HttpError } from './extract.js'
import { createAI } from './ai.js'
import { getAssignment, getSession, sessionView, makeBank, nextQuestion, finalizeReport } from './flow.js'

export function createApp(db, config, dependencies = {}) {
  const app = express()
  const ai = dependencies.ai || createAI(config, dependencies.fetch || fetch)
  const request = dependencies.fetch || fetch
  const busy = new Set()
  const audioCache = new Map()
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 8, fieldSize: 250000 } })
  const lock = (key, fn) => async (req, res, next) => {
    const resource = typeof key === 'function' ? key(req) : key
    if (busy.has(resource)) return next(new HttpError(409, 'This step is already processing. Please wait, then retry.'))
    busy.add(resource)
    try { await fn(req, res) } catch (error) { next(error) } finally { busy.delete(resource) }
  }
  app.disable('x-powered-by')
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store')
    res.set('X-Content-Type-Options', 'nosniff')
    const origin = req.get('origin')
    if (origin && origin !== `${req.protocol}://${req.get('host')}`) return next(new HttpError(403, 'Cross-origin requests are not supported.'))
    next()
  })
  app.use(express.json({ limit: '256kb' }))

  app.get('/api/config', (req, res) => res.json({
    mode: config.demo ? 'demo' : 'live', aiConfigured: Boolean(config.openaiKey),
    voice: config.elevenKey ? 'elevenlabs' : 'browser',
    storage: 'sqlite', maxFileMB: 10, maxTextCharacters: 60000,
  }))
  app.get('/api/assignments', (req, res) => {
    const rows = db.prepare(`SELECT a.*,
      (SELECT COUNT(*) FROM questions q WHERE q.assignment_id = a.id AND q.approved = 1) AS approved_count,
      (SELECT COUNT(*) FROM submissions u WHERE u.assignment_id = a.id) AS submission_count
      FROM assignments a ORDER BY created_at DESC`).all()
    res.json(rows.map(row => ({ ...row, concepts: JSON.parse(row.concepts) })))
  })
  app.post('/api/assignments', (req, res) => {
    const title = requiredText(req.body.title, 'Assignment title', 140)
    const subject = requiredText(req.body.subject || 'General', 'Subject', 100)
    const brief = requiredText(req.body.brief, 'Assignment brief', 8000)
    const concepts = parseConcepts(req.body.concepts)
    const assignmentId = id()
    db.prepare('INSERT INTO assignments VALUES (?, ?, ?, ?, ?, ?)').run(assignmentId, title, subject, brief, JSON.stringify(concepts), now())
    res.status(201).json(getAssignment(db, assignmentId))
  })
  app.get('/api/assignments/:id', (req, res) => res.json({ ...getAssignment(db, req.params.id),
    questions: db.prepare('SELECT * FROM questions WHERE assignment_id = ? ORDER BY created_at, rowid').all(req.params.id).map(row => ({ ...row, approved: Boolean(row.approved) })),
  }))
  app.patch('/api/assignments/:id', (req, res) => {
    getAssignment(db, req.params.id)
    const concepts = parseConcepts(req.body.concepts)
    db.prepare('UPDATE assignments SET concepts = ? WHERE id = ?').run(JSON.stringify(concepts), req.params.id)
    res.json(getAssignment(db, req.params.id))
  })
  app.post('/api/assignments/:id/generate', lock(req => `generate:${req.params.id}`, async (req, res) => {
    const assignment = getAssignment(db, req.params.id)
    const questions = await ai.generate(assignment)
    transaction(db, () => {
      for (const q of questions) {
        if (!q.text.trim() || !q.concept.trim()) continue
        if (db.prepare('SELECT id FROM questions WHERE assignment_id = ? AND text = ?').get(assignment.id, q.text)) continue
        db.prepare('INSERT INTO questions VALUES (?, ?, ?, ?, ?, ?, ?)').run(id(), assignment.id, q.concept.slice(0, 160), q.text.slice(0, 1000), 0, config.demo ? 'demo' : 'ai', now())
      }
    })
    res.json({ generated: questions.length })
  }))
  app.post('/api/assignments/:id/questions', (req, res) => {
    getAssignment(db, req.params.id)
    const questionId = id()
    db.prepare('INSERT INTO questions VALUES (?, ?, ?, ?, ?, ?, ?)').run(questionId, req.params.id,
      requiredText(req.body.concept, 'Concept', 160), requiredText(req.body.text, 'Question', 1000), 1, 'teacher', now())
    res.status(201).json({ id: questionId })
  })
  app.patch('/api/questions/:id', (req, res) => {
    const old = db.prepare('SELECT * FROM questions WHERE id = ?').get(req.params.id)
    if (!old) throw new HttpError(404, 'Question not found.')
    const text = req.body.text === undefined ? old.text : requiredText(req.body.text, 'Question', 1000)
    const concept = req.body.concept === undefined ? old.concept : requiredText(req.body.concept, 'Concept', 160)
    if (req.body.approved !== undefined && typeof req.body.approved !== 'boolean') throw new HttpError(400, 'Approval must be true or false.')
    const edited = text !== old.text || concept !== old.concept
    const approved = req.body.approved === undefined ? (edited ? 0 : old.approved) : Number(req.body.approved)
    db.prepare('UPDATE questions SET text = ?, concept = ?, approved = ? WHERE id = ?').run(text, concept, approved, old.id)
    res.json({ ...old, text, concept, approved: Boolean(approved) })
  })
  app.delete('/api/questions/:id', (req, res) => {
    const result = db.prepare('DELETE FROM questions WHERE id = ?').run(req.params.id)
    if (!result.changes) throw new HttpError(404, 'Question not found.')
    res.status(204).end()
  })

  app.post('/api/submissions', upload.single('file'), lock(req => `upload:${req.body.requestId}`, async (req, res) => {
    const requestId = requiredText(req.body.requestId, 'Request ID', 80)
    if (!/^[a-zA-Z0-9-]{10,80}$/.test(requestId)) throw new HttpError(400, 'Invalid request ID.')
    const previous = db.prepare('SELECT id FROM sessions WHERE submission_id = ?').get(requestId)
    if (previous) return res.json(sessionView(db, previous.id))
    const assignment = getAssignment(db, req.body.assignmentId)
    const student = requiredText(req.body.student, 'Student name', 100)
    const { text, filename } = await extractText(req.file, req.body.text)
    const analysis = await ai.analyze(text, assignment)
    const approved = db.prepare('SELECT * FROM questions WHERE assignment_id = ? AND approved = 1 ORDER BY created_at, rowid').all(assignment.id)
    const bank = makeBank(analysis, approved)
    const sessionId = id()
    transaction(db, () => {
      db.prepare('INSERT INTO submissions VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(requestId, assignment.id, student, filename, text, JSON.stringify(analysis), config.demo ? 'demo' : 'live', now())
      db.prepare(`INSERT INTO sessions (id, submission_id, status, bank, current, created_at) VALUES (?, ?, 'active', ?, ?, ?)`)
        .run(sessionId, requestId, JSON.stringify(bank), JSON.stringify(bank[0]), now())
    })
    res.status(201).json(sessionView(db, sessionId))
  }))
  app.get('/api/submissions', (req, res) => res.json(db.prepare(`SELECT u.id, u.student, u.filename, u.mode, u.created_at,
    a.title AS assignment_title, a.id AS assignment_id, s.id AS session_id, s.status, r.id AS report_id,
    (SELECT COUNT(*) FROM answers WHERE session_id = s.id) AS answer_count
    FROM submissions u JOIN assignments a ON a.id = u.assignment_id
    JOIN sessions s ON s.submission_id = u.id LEFT JOIN reports r ON r.session_id = s.id
    ORDER BY u.created_at DESC`).all()))
  app.get('/api/sessions/:id', (req, res) => res.json(sessionView(db, req.params.id)))
  app.post('/api/sessions/:id/present', (req, res) => {
    const session = getSession(db, req.params.id)
    requireCurrent(session, req.body.questionId)
    if (!session.question_started_at) db.prepare('UPDATE sessions SET question_started_at = ? WHERE id = ?').run(now(), session.id)
    res.json(sessionView(db, session.id))
  })
  app.post('/api/sessions/:id/response-ended', (req, res) => {
    const session = getSession(db, req.params.id)
    requireCurrent(session, req.body.questionId)
    if (!session.question_started_at) throw new HttpError(409, 'Listen to or reveal the question before answering.')
    if (!session.response_ended_at) db.prepare('UPDATE sessions SET response_ended_at = ? WHERE id = ?').run(now(), session.id)
    res.json(sessionView(db, session.id))
  })
  app.post('/api/sessions/:id/response-resume', (req, res) => {
    const session = getSession(db, req.params.id)
    requireCurrent(session, req.body.questionId)
    db.prepare('UPDATE sessions SET response_ended_at = NULL WHERE id = ?').run(session.id)
    res.json(sessionView(db, session.id))
  })
  app.post('/api/sessions/:id/answers', lock(req => `session:${req.params.id}`, async (req, res) => {
    const session = getSession(db, req.params.id)
    const duplicate = db.prepare('SELECT id FROM answers WHERE session_id = ? AND question_id = ?').get(session.id, req.body.questionId || '')
    if (duplicate) return res.json(sessionView(db, session.id))
    requireCurrent(session, req.body.questionId)
    if (!session.question_started_at) throw new HttpError(409, 'Listen to or reveal the question before answering.')
    const transcript = typeof req.body.transcript === 'string' ? req.body.transcript.trim() : ''
    if (transcript.length > 12000) throw new HttpError(400, 'Please keep your answer under 12,000 characters.')
    if (!transcript && req.body.skip !== true) throw new HttpError(400, 'Record or type an answer, or choose Skip question.')
    const method = ['voice', 'text', 'skipped'].includes(req.body.method) ? req.body.method : 'text'
    const endedAt = session.response_ended_at || now()
    // Persist before the provider call so retry latency never changes the recorded response time.
    if (!session.response_ended_at) db.prepare('UPDATE sessions SET response_ended_at = ? WHERE id = ?').run(endedAt, session.id)
    const seconds = Math.max(0, (Date.parse(endedAt) - Date.parse(session.question_started_at)) / 1000)
    const evaluation = transcript ? await ai.evaluate(session.analysis, session.current, transcript, session.mode) : {
      status: 'UNCLEAR', explanation: 'The student skipped this question. No response evidence is available.',
      followUp: `In simple terms, what does ${session.current.concept.toLowerCase()} mean in your work?`,
    }
    const answers = db.prepare('SELECT * FROM answers WHERE session_id = ? ORDER BY position').all(session.id)
    const answer = { concept: session.current.concept, question: session.current.text }
    const next = nextQuestion(session, [...answers, answer], evaluation)
    transaction(db, () => {
      db.prepare(`INSERT INTO answers VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        id(), session.id, session.current.id, answers.length + 1, session.current.text, session.current.concept, session.current.source,
        transcript, transcript ? method : 'skipped', evaluation.status, evaluation.explanation,
        session.question_started_at, endedAt, seconds, Number(seconds >= session.duration),
      )
      db.prepare('UPDATE sessions SET current = ?, status = ?, question_started_at = NULL, response_ended_at = NULL WHERE id = ?')
        .run(JSON.stringify(next || {}), next ? 'active' : 'reporting', session.id)
    })
    if (!next) {
      try { await finalizeReport(db, ai, session.id) }
      catch (error) { return res.json({ ...sessionView(db, session.id), reportError: error.message }) }
    }
    res.json(sessionView(db, session.id))
  }))
  app.post('/api/sessions/:id/report', lock(req => `session:${req.params.id}`, async (req, res) => {
    await finalizeReport(db, ai, req.params.id)
    res.json(sessionView(db, req.params.id))
  }))
  app.get('/api/reports/:id', (req, res) => {
    const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(req.params.id)
    if (!report) throw new HttpError(404, 'Report not found.')
    const session = getSession(db, report.session_id)
    const answers = db.prepare('SELECT * FROM answers WHERE session_id = ? ORDER BY position').all(session.id)
    res.json({ ...report, strengths: JSON.parse(report.strengths), reviewAreas: JSON.parse(report.review_areas),
      student: session.student, assignmentTitle: session.assignment_title, assignmentId: session.assignment_id,
      filename: session.filename, answers: answers.map(a => ({ ...a, timer_expired: Boolean(a.timer_expired) })), analysis: session.analysis,
    })
  })

  app.post('/api/sessions/:id/speech', lock(req => `speech:${req.params.id}`, async (req, res) => {
    if (!config.elevenKey) throw new HttpError(503, 'ElevenLabs is not configured. Use browser audio or See Question.')
    const session = getSession(db, req.params.id)
    requireCurrent(session, req.body.questionId)
    const cacheKey = session.current.id
    let audio = audioCache.get(cacheKey)
    if (!audio) {
      let response
      try {
        response = await request(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(config.voice)}?output_format=mp3_44100_128`, {
          method: 'POST', headers: { 'xi-api-key': config.elevenKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: session.current.text, model_id: config.ttsModel }), signal: AbortSignal.timeout(30000),
        })
      } catch { throw new HttpError(502, 'Voice playback could not be reached. Try Listen Again or See Question.') }
      if (!response.ok) throw new HttpError(502, `ElevenLabs speech failed (${response.status}). Try See Question or check the server voice configuration.`)
      audio = Buffer.from(await response.arrayBuffer())
      if (audioCache.size >= 30) audioCache.delete(audioCache.keys().next().value)
      audioCache.set(cacheKey, audio)
    }
    res.type('audio/mpeg').send(audio)
  }))
  app.post('/api/sessions/:id/transcribe', upload.single('audio'), lock(req => `transcribe:${req.params.id}`, async (req, res) => {
    const session = getSession(db, req.params.id)
    requireCurrent(session, req.body.questionId)
    if (!config.elevenKey) throw new HttpError(503, 'ElevenLabs is not configured. Use browser dictation or type your answer.')
    if (!req.file || !/^(audio\/|video\/webm)/.test(req.file.mimetype)) throw new HttpError(400, 'Send a recorded audio file.')
    const form = new FormData()
    form.append('file', new Blob([req.file.buffer], { type: req.file.mimetype }), req.file.originalname)
    form.append('model_id', config.sttModel)
    form.append('tag_audio_events', 'false')
    let response
    try { response = await request('https://api.elevenlabs.io/v1/speech-to-text', { method: 'POST', headers: { 'xi-api-key': config.elevenKey }, body: form, signal: AbortSignal.timeout(60000) }) }
    catch { throw new HttpError(502, 'Transcription could not be reached. Your recording is kept in this tab; retry or type instead.') }
    if (!response.ok) throw new HttpError(502, `Transcription failed (${response.status}). Retry your recording or type instead.`)
    const result = await response.json()
    if (!result.text?.trim()) throw new HttpError(422, 'No speech was heard. Try recording again or type your answer.')
    res.json({ text: result.text })
  }))

  app.use('/api', (req, res) => res.status(404).json({ error: 'API route not found.' }))
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error)
    const status = error instanceof multer.MulterError ? 400 : error.status || 500
    const message = error.code === 'LIMIT_FILE_SIZE' ? 'Files must be smaller than 10 MB.'
      : status >= 500 && !(error instanceof HttpError) ? 'Something went wrong on the server. Please try again.' : error.message
    if (status === 500) console.error('Server error:', error.name, error.message)
    res.status(status).json({ error: message })
  })
  return app
}

function requireCurrent(session, questionId) {
  if (session.status !== 'active' || session.current.id !== questionId) throw new HttpError(409, 'This question is no longer current. Refresh to resume your session.')
}
function parseConcepts(value) {
  if (!Array.isArray(value) || value.length > 12) throw new HttpError(400, 'Provide up to 12 core concepts.')
  return [...new Set(value.map(v => requiredText(v, 'Core concept', 160)))]
}
