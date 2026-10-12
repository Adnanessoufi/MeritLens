import { configureHosting } from './hosting.js'
import {offTopicFeedback,offTopicSummary} from '../shared/off-topic.js'
import {createReportLocalizer} from './localization.js'
import {learningConceptVisible} from '../shared/report-results.js'
import {preparedInterview} from './prepared-interviews.js'
import {numericSuggestedGrade} from '../shared/grade-score.js'
import {renderReportPdf} from './report-pdf.js'
import { responseKind, conversationLead } from '../shared/conversation.js'
import express from 'express'
import multer from 'multer'
import { id, now, transaction } from './db.js'
import { extractText, requiredText, HttpError, MAX_TEXT, MAX_DOCUMENT_TEXT } from './extract.js'
import { createAI } from './ai.js'
import { getAssignment, getSession, sessionView, makeBank, nextQuestion, finalizeReport } from './flow.js'
import { languages, demoQuestion } from './languages.js'
import { transferProfiles } from '../shared/transfer-fixtures.js'
import { transferBank, responseStatus, skippedTransferAssessment, selectTransferConcepts } from './transfer.js'
import { evidenceReceipt } from './evidence.js'
import {renderEvidenceText} from './evidence-text.js'
import { activityView } from './activity.js'
import { CAMERA_EVENT_TYPES, cameraEventDetails } from './camera-observations.js'
import { probe, showcaseCases } from './demo.js'
import { getVoiceProvider, getSpeechIdentity, synthesizeSpeech, transcribeAudio } from './speech.js'
import { meetingQuestionDuration } from '../shared/meeting-timer.js'
import { installMeetingRoutes, enforceMeetingDeadline, readMeeting } from './meeting.js'
import { parseRubric } from './grading.js'
import { installInterviewLifecycle } from './lifecycle.js'
import { createAvatarService } from './avatar.js'
import { QUESTION_DURATION_SECONDS, RESPONSE_TIME_OPTIONS, withQuestionTiming } from '../shared/timer.js'

export function createApp(db, config, dependencies = {}) {
  const app = express()
  configureHosting(app, db, config)
  const savedMode = db.prepare("SELECT value FROM settings WHERE key = 'assessment_mode'").get()?.value
  if (savedMode) config.demo = savedMode === 'demo'
  const savedVoice = db.prepare("SELECT value FROM settings WHERE key = 'voice_provider'").get()?.value
  if (savedVoice) config.voiceProvider = savedVoice
  let providerHealth = { openai: 'unchecked', voice: getVoiceProvider(config) === 'browser' ? 'browser' : 'unchecked' }
  const ai = dependencies.ai || createAI(config, dependencies.fetch || fetch)
  const localizeReport=createReportLocalizer(ai)
  const request = dependencies.fetch || fetch
  const busy = new Set()
  const audioCache = new Map()
  async function audioFor(session,questionOnly=false) {
    const view=sessionView(db,session.id)
    const spokenText=readMeeting(session).enabled&&!questionOnly?view.spokenQuestionText:session.current.text
    const speechOptions=readMeeting(session).enabled&&!questionOnly?{delivery:view.lastAnswerDelivery,neutralTail:session.current.text}:{}
    const key = getSpeechIdentity(config) + ':' + session.current.id + ':' + session.language + ':' + spokenText+':'+JSON.stringify(speechOptions)
    if (!audioCache.has(key)) {
      if (audioCache.size >= 30) audioCache.delete(audioCache.keys().next().value)
      const pending = synthesizeSpeech(config, spokenText, request,speechOptions).catch(error => { if (audioCache.get(key) === pending) audioCache.delete(key); throw error })
      audioCache.set(key, pending)
    }
    return audioCache.get(key)
  }
  const avatar = createAvatarService(config, request, audioFor)
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
    voice: getVoiceProvider(config), voiceName:getVoiceProvider(config)==='elevenlabs'?(config.elevenVoiceName||'Selected voice'):getVoiceProvider(config)==='openai'?(config.openaiVoice||'coral'):'Browser', elevenlabsConfigured: Boolean(config.elevenKey),
    avatarConfigured: true, avatarProvider: 'local-mouth',
    storage: 'sqlite', maxFileMB: 10, maxTextCharacters: MAX_TEXT, maxDocumentCharacters: MAX_DOCUMENT_TEXT, providerHealth,
  }))
  app.post('/api/settings/mode', (req, res) => {
    if (!['demo', 'live'].includes(req.body.mode)) throw new HttpError(400, 'Choose practice or live assessment.')
    if (req.body.mode === 'live' && !config.openaiKey) throw new HttpError(503, 'Add a valid OPENAI_API_KEY to the server .env file and restart before using live assessment.')
    config.demo = req.body.mode === 'demo'
    db.prepare("INSERT INTO settings (key, value) VALUES ('assessment_mode', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(req.body.mode)
    res.json({ mode: req.body.mode })
  })
  app.post('/api/settings/voice', (req, res) => {
    const provider = req.body.provider
    if (!['browser', 'openai', 'elevenlabs'].includes(provider)) throw new HttpError(400, 'Choose a supported voice service.')
    if (provider === 'openai' && !config.openaiKey || provider === 'elevenlabs' && !config.elevenKey) throw new HttpError(503, 'This voice service needs a server API key. Add it to .env and restart.')
    config.voiceProvider = provider
    providerHealth.voice = provider === 'browser' ? 'browser' : 'unchecked'
    db.prepare("INSERT INTO settings (key, value) VALUES ('voice_provider', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(provider)
    audioCache.clear()
    res.json({ voice: provider })
  })
  app.post('/api/settings/providers/check', lock('provider-health', async (req, res) => {
    const check = async (url, headers, configured) => {
      if (!configured) return { status: 'missing', message: 'No server key is configured.' }
      try {
        const result = await request(url, { headers, signal: AbortSignal.timeout(15000) })
        return result.ok ? { status: 'connected', message: 'Connection verified.' }
          : { status: 'error', message: result.status === 401 ? 'The provider rejected the API key (401). Update it in the server .env file and restart.' : 'Provider access check failed (' + result.status + '). Check key permissions and model or voice access.' }
      } catch { return { status: 'error', message: 'The provider could not be reached. Check the connection and retry.' } }
    }
    const [openai, voice] = await Promise.all([
      check('https://api.openai.com/v1/models/' + encodeURIComponent(config.model), { Authorization: 'Bearer ' + config.openaiKey }, Boolean(config.openaiKey)),
      getVoiceProvider(config) === 'openai' ? check('https://api.openai.com/v1/models/' + encodeURIComponent(config.openaiSttModel || 'whisper-1'), { Authorization: 'Bearer ' + config.openaiKey }, Boolean(config.openaiKey))
        : getVoiceProvider(config) === 'elevenlabs' ? check('https://api.elevenlabs.io/v1/voices/' + encodeURIComponent(config.voice), { 'xi-api-key': config.elevenKey }, Boolean(config.elevenKey)) : Promise.resolve({ status: 'browser', message: 'Using browser speech services.' }),
    ])
    providerHealth = { openai: openai.status, voice: voice.status }
    res.json({ openai, voice })
  }))
  app.get('/api/transfer/demo', (req, res) => {
    const rows = db.prepare("SELECT u.showcase_kind, r.id, r.transfer_summary FROM submissions u JOIN sessions s ON s.submission_id = u.id JOIN reports r ON r.session_id = s.id WHERE s.challenge_mode = 'transfer' AND u.showcase_kind LIKE 'transfer-%' ORDER BY u.created_at DESC").all()
    const validation = db.prepare("SELECT value FROM settings WHERE key = 'transfer_validation'").get()
    res.json({ examples: transferProfiles.map(profile => {
      const row = rows.find(r => r.showcase_kind === 'transfer-' + profile.kind)
      return { kind: profile.kind, title: profile.kind === 'weak' ? 'Explains it, cannot transfer it' : profile.kind === 'partial' ? 'Recognizes the change, misses a step' : 'Changes the approach, preserves the principle',
        description: profile.description, reportId: row?.id || null, summary: row ? JSON.parse(row.transfer_summary) : null }
    }), generatedPlan: JSON.parse(db.prepare("SELECT value FROM settings WHERE key = 'transfer_generated_plan'").get()?.value || 'null'), validation: validation ? JSON.parse(validation.value) : null })
  })
  app.get('/api/showcase', (req, res) => {
    const rows = db.prepare("SELECT u.showcase_kind, u.student, s.id AS session_id, r.id AS report_id, (SELECT next_report.id FROM sessions child JOIN reports next_report ON next_report.session_id = child.id WHERE child.parent_session_id = s.id) AS follow_up_report_id FROM submissions u JOIN sessions s ON s.submission_id = u.id JOIN reports r ON r.session_id = s.id WHERE u.showcase_kind <> '' AND s.parent_session_id IS NULL ORDER BY u.created_at DESC").all()
    res.json({ cases: showcaseCases.map(c => { const saved = rows.find(r => r.showcase_kind === c.kind); return { kind: c.kind, title: c.title, description: c.description, student: c.student, reportId: saved?.report_id || null, followUpReportId: saved?.follow_up_report_id || null, sessionId: saved?.session_id || null } }), question: probe.question, examples: probe.examples })
  })
  app.post('/api/demo/probe', lock('demo-probe', async (req, res) => {
    const transcript = requiredText(req.body.transcript, 'Your explanation', 2000)
    const evaluation = await ai.evaluate(probe.analysis, probe.question, transcript, config.demo ? 'demo' : 'live')
    res.json({ ...evaluation, mode: config.demo ? 'demo' : 'live' })
  }))
  app.get('/api/assignments', (req, res) => {
    const rows = db.prepare(`SELECT a.*,
      (SELECT COUNT(*) FROM questions q WHERE q.assignment_id = a.id AND q.approved = 1) AS approved_count,
      (SELECT COUNT(*) FROM submissions u WHERE u.assignment_id = a.id AND u.archived = 0) AS submission_count
      FROM assignments a WHERE a.deleted_at IS NULL ORDER BY created_at DESC`).all()
    res.json(rows.map(({reference_answer, rubric, ...row}) => ({ ...row, concepts: JSON.parse(row.concepts), challenge_concepts: JSON.parse(row.challenge_concepts || '[]') })))
  })
  app.delete('/api/assignments/:id',(req,res)=>{getAssignment(db,req.params.id);db.prepare('UPDATE assignments SET deleted_at=? WHERE id=?').run(now(),req.params.id);res.json({deleted:true})})
  app.post('/api/assignments/:id/restore',(req,res)=>{getAssignment(db,req.params.id);db.prepare('UPDATE assignments SET deleted_at=NULL WHERE id=?').run(req.params.id);res.json({restored:true})})
  app.post('/api/assignments/prepare', upload.single('file'), lock('assignment-prepare', async(req,res)=>{
    const {text,filename}=await extractText(req.file,req.body.text)
    if(req.body.kind==='reference')return res.json({text,filename})
    res.json({...await ai.prepareAssignment(text,req.body.subject||'',req.body.kind,req.body.language==='hu'?'hu':'en'),text,filename})
  }))
  app.get('/api/teacher/assignments/:id', (req,res)=>res.json({...getAssignment(db,req.params.id),questions:db.prepare('SELECT * FROM questions WHERE assignment_id = ? ORDER BY created_at,rowid').all(req.params.id).map(q=>({...q,approved:Boolean(q.approved)}))}))
  app.post('/api/assignments', (req, res) => {
    const title = requiredText(req.body.title, 'Assignment title', 140)
    const subject = requiredText(req.body.subject || 'General', 'Subject', 100)
    const brief = requiredText(req.body.brief, 'Assignment brief', 8000)
    const concepts = parseConcepts(req.body.concepts ?? [])
    const policy=assignmentChallenge(req.body.challengeMode??'standard',req.body.pairCount??2)
    const challengeConcepts=parseChallengeConcepts(req.body.challengeConcepts??[],policy.count)
    const questionLimit=parseQuestionLimit(req.body.questionLimit??6)
    const assignmentId = id()
    const duration = parseDuration(req.body.responseSeconds ?? QUESTION_DURATION_SECONDS)
    const timingMode = parseTimingMode(req.body.timingMode ?? (req.body.responseSeconds === undefined ? 'adaptive' : 'fixed'))
    const rubric=parseRubric(req.body.rubric)
    const instructions=optionalText(req.body.instructionsText??'','Assignment instructions',60000)
    const filename=optionalText(req.body.instructionsFilename??'','Instruction filename',200)
    const reference=optionalText(req.body.referenceAnswer??'','Reference solution',60000)
    db.prepare('INSERT INTO assignments (id, title, subject, brief, concepts, created_at, response_seconds, timing_mode) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(assignmentId, title, subject, brief, JSON.stringify(concepts), now(), duration, timingMode)
    db.prepare('UPDATE assignments SET rubric=?, instructions_text=?, instructions_filename=?, reference_answer=? WHERE id=?').run(JSON.stringify(rubric),instructions,filename,reference,assignmentId)
    db.prepare('UPDATE assignments SET challenge_mode=?, concept_count=?, question_limit=?, challenge_concepts=? WHERE id=?').run(policy.mode,policy.count,questionLimit,JSON.stringify(challengeConcepts),assignmentId)
    res.status(201).json(getAssignment(db, assignmentId))
  })
  app.get('/api/assignments/:id', (req, res) => res.json({ ...publicAssignment(getAssignment(db, req.params.id)),
    questions: db.prepare('SELECT * FROM questions WHERE assignment_id = ? ORDER BY created_at, rowid').all(req.params.id).map(row => ({ ...row, approved: Boolean(row.approved) })),
  }))
  app.patch('/api/assignments/:id', (req, res) => {
    const old = getAssignment(db, req.params.id)
    const policy=assignmentChallenge(req.body.challengeMode??old.challenge_mode,req.body.pairCount??old.concept_count)
    const challengeConcepts=parseChallengeConcepts(req.body.challengeConcepts??old.challenge_concepts,policy.count)
    const questionLimit=parseQuestionLimit(req.body.questionLimit??6)
    const title = req.body.title === undefined ? old.title : requiredText(req.body.title, 'Assignment title', 140)
    const subject = req.body.subject === undefined ? old.subject : requiredText(req.body.subject, 'Subject', 100)
    const brief = req.body.brief === undefined ? old.brief : requiredText(req.body.brief, 'Assignment brief', 8000)
    const concepts = req.body.concepts === undefined ? old.concepts : parseConcepts(req.body.concepts)
    const duration = req.body.responseSeconds === undefined ? old.response_seconds : parseDuration(req.body.responseSeconds)
    const timingMode = parseTimingMode(req.body.timingMode ?? (req.body.responseSeconds === undefined ? old.timing_mode : 'fixed'))
    const status = req.body.status ?? old.status
    if (!['open', 'closed'].includes(status)) throw new HttpError(400, 'Assignment status must be open or closed.')
    const rubric=req.body.rubric===undefined?old.rubric:parseRubric(req.body.rubric)
    const instructions=req.body.instructionsText===undefined?old.instructions_text:optionalText(req.body.instructionsText??'','Assignment instructions',60000)
    const reference=req.body.referenceAnswer===undefined?old.reference_answer:optionalText(req.body.referenceAnswer??'','Reference solution',60000)
    db.prepare('UPDATE assignments SET title = ?, subject = ?, brief = ?, concepts = ?, response_seconds = ?, timing_mode = ?, status = ? WHERE id = ?')
      .run(title, subject, brief, JSON.stringify(concepts), duration, timingMode, status, req.params.id)
    db.prepare('UPDATE assignments SET rubric=?, instructions_text=?, reference_answer=? WHERE id=?').run(JSON.stringify(rubric),instructions,reference,old.id)
    db.prepare('UPDATE assignments SET challenge_mode=?, concept_count=?, question_limit=?, challenge_concepts=? WHERE id=?').run(policy.mode,policy.count,questionLimit,JSON.stringify(challengeConcepts),old.id)
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
    if(assignment.deleted_at)throw new HttpError(410,'This assignment was deleted. Contact your teacher.')
    if (assignment.status === 'closed') throw new HttpError(409, 'This assignment is closed for new submissions. Contact your teacher.')
    const student = requiredText(req.body.student, 'Student name', 100)
    const { text, filename } = await extractText(req.file, req.body.text)
    const language = Object.hasOwn(languages, req.body.language) ? req.body.language : 'en'
    const challengeMode=assignment.challenge_mode, pairCount=assignment.concept_count
    if(req.body.challengeMode!==undefined&&req.body.challengeMode!==challengeMode)throw new HttpError(409,'The interview mode is set by your teacher. Reload the assignment.')
    if(req.body.questionLimit!==undefined&&Number(req.body.questionLimit)!==assignment.question_limit)throw new HttpError(409,'The question limit is set by your teacher.')
    if(req.body.pairCount!==undefined&&Number(req.body.pairCount)!==pairCount)throw new HttpError(409,'The number of concepts is set by your teacher. Reload the assignment.')
    if(challengeMode==='transfer'&&config.demo)throw new HttpError(503,'Your teacher must enable live AI in Settings to run this transfer challenge.')
    const workAssessment=assignment.rubric.length&&!config.demo?await ai.assessSubmission(text,assignment,language==='hu'?'hu':'en'):null
    const preparedSource=preparedInterview(text,assignment)
    const prepared=preparedSource
    const analysis = prepared?.analysis || await ai.analyze(text, {...assignment,concepts:challengeMode==='transfer'&&assignment.challenge_concepts.length?assignment.challenge_concepts:assignment.concepts,workConcerns:workAssessment?.criteria?.filter(c=>c.concern)}, 'en')
    if(!config.demo&&!analysis.concepts.length)throw new HttpError(422,'No clear concepts could be grounded in this submission. Upload more complete work so the interview can ask about it.')
    analysis.workAssessment=workAssessment
    analysis.assignmentSnapshot={title:assignment.title,subject:assignment.subject,brief:assignment.brief,instructions_text:assignment.instructions_text,rubric:assignment.rubric,reference_answer:assignment.reference_answer,challenge_mode:challengeMode,concept_count:pairCount,challenge_concepts:assignment.challenge_concepts}
    const approved = db.prepare('SELECT * FROM questions WHERE assignment_id = ? AND approved = 1 ORDER BY created_at, rowid').all(assignment.id)
    let preparedPairs=prepared?.pairs.slice(0,pairCount)
    if(challengeMode==='transfer'&&prepared&&assignment.challenge_concepts.length){
      const allowed=prepared.pairs.map(p=>p.concept)
      if(assignment.challenge_concepts.some(name=>!allowed.some(c=>c.toLowerCase()===name.toLowerCase())))throw new HttpError(422,'For this demo challenge, choose '+allowed.join(', ')+', or leave the concepts field blank to use the agreed pairs.')
      const selected=selectTransferConcepts({...analysis,concepts:analysis.concepts.filter(c=>allowed.includes(c.name))},assignment.challenge_concepts,pairCount,true)
      preparedPairs=selected.map(c=>prepared.pairs.find(p=>p.concept===c.name))
    }
    const sourceBank = challengeMode === 'transfer'
      ? transferBank(preparedPairs||await ai.generateTransferPairs(analysis, assignment, text, pairCount)) : makeBank(analysis, [])
    const bank = (await ai.translateQuestions(sourceBank, language)).map((question, index) => ({ ...question, originalText: sourceBank[index].text })).map(question => withQuestionTiming(question, assignment.timing_mode, assignment.response_seconds))
    const sessionId = id()
    transaction(db, () => {
      db.prepare('INSERT INTO submissions (id, assignment_id, student, filename, text, analysis, mode, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(requestId, assignment.id, student, filename, text, JSON.stringify(analysis), config.demo ? 'demo' : 'live', now())
      db.prepare(`INSERT INTO sessions (id, submission_id, status, bank, current, created_at, language, duration, challenge_mode, timing_mode, base_duration, question_limit) VALUES (?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(sessionId, requestId, JSON.stringify(bank), JSON.stringify(bank[0]), now(), language, bank[0].durationSeconds || assignment.response_seconds, challengeMode, assignment.timing_mode, assignment.response_seconds,6)
    })
    res.status(201).json(sessionView(db, sessionId))
  }))
  app.get('/api/submissions', (req, res) => res.json(db.prepare(`SELECT u.id, u.student, u.filename, u.mode, u.created_at, u.showcase_kind,
    a.title AS assignment_title, a.id AS assignment_id, s.id AS session_id, s.status, s.parent_session_id, s.challenge_mode, s.question_started_at, s.meeting, r.id AS report_id, r.review_status, r.released_at, s.defence_skipped,
    (SELECT COUNT(*) FROM answers WHERE session_id = s.id AND status IN ('PARTIAL', 'UNCLEAR')) AS review_count,
    (SELECT COUNT(*) FROM answers WHERE session_id = s.id) AS answer_count,
    (SELECT COUNT(*) FROM answers WHERE session_id=s.id AND json_extract(rubric,'$.offTopic')=1) AS off_topic_count
    FROM submissions u JOIN assignments a ON a.id = u.assignment_id
    JOIN sessions s ON s.submission_id = u.id LEFT JOIN reports r ON r.session_id = s.id
    WHERE u.archived = 0 AND a.deleted_at IS NULL ORDER BY u.created_at DESC, s.created_at DESC`).all()))
  app.get('/api/insights', (req, res) => {
    const assignments = db.prepare('SELECT id, title, subject FROM assignments WHERE deleted_at IS NULL ORDER BY created_at DESC').all()
    const submissions = db.prepare('SELECT u.assignment_id, s.status, s.defence_skipped, r.review_status FROM submissions u JOIN sessions s ON s.submission_id = u.id LEFT JOIN reports r ON r.session_id = s.id WHERE u.archived = 0 AND u.assignment_id IN (SELECT id FROM assignments WHERE deleted_at IS NULL)').all()
    const reports = db.prepare('SELECT u.id AS submission_id, u.assignment_id, r.mode, s.challenge_mode, r.concept_evidence FROM reports r JOIN sessions s ON s.id = r.session_id JOIN submissions u ON u.id = s.submission_id WHERE u.archived = 0 AND u.assignment_id IN (SELECT id FROM assignments WHERE deleted_at IS NULL) ORDER BY r.created_at DESC, r.rowid DESC').all()
    const concepts = new Map()
    const observed = new Set()
    for (const report of reports.filter(r => r.mode === 'live')) {
      for (const evidence of JSON.parse(report.concept_evidence)) {
        if (!learningConceptVisible(report.assignment_id, evidence.concept) || !['DEMONSTRATED','PARTIAL','UNCLEAR'].includes(evidence.status)) continue
        const observation = report.submission_id + ':' + report.challenge_mode + ':' + evidence.concept
        if (observed.has(observation)) continue
        observed.add(observation)
        const key = report.assignment_id + ':' + report.challenge_mode + ':' + evidence.concept
        if (!concepts.has(key)) concepts.set(key, { assignmentId: report.assignment_id, challengeMode: report.challenge_mode, concept: evidence.concept, DEMONSTRATED: 0, PARTIAL: 0, UNCLEAR: 0 })
        concepts.get(key)[evidence.status]++
      }
    }
    res.json({ assignments: assignments.map(a => {
      const rows = submissions.filter(s => s.assignment_id === a.id)
      return { ...a, submitted: rows.length, completed: rows.filter(s => s.status === 'completed').length,
        pendingReview: rows.filter(s => s.review_status === 'pending').length, followUp: rows.filter(s => s.review_status === 'follow-up').length,
        skipped: rows.filter(s => s.defence_skipped).length }
    }), concepts: [...concepts.values()].sort((a, b) => (b.PARTIAL + b.UNCLEAR) - (a.PARTIAL + a.UNCLEAR)),
      liveReports: reports.filter(r => r.mode === 'live').length, practiceReports: reports.filter(r => r.mode === 'demo').length })
  })
  installMeetingRoutes(app,db,config,ai,request)
  app.get('/api/sessions/:id', (req, res) => { enforceMeetingDeadline(db,req.params.id); res.json(sessionView(db, req.params.id)) })
  app.get('/api/sessions/:id/activity', (req, res) => {
    getSession(db, req.params.id)
    res.json(activityView(db, req.params.id))
  })
  app.post('/api/sessions/:id/activity', (req, res) => {
    const session = getSession(db, req.params.id)
    const eventId = requiredText(req.body.eventId, 'Event ID', 80)
    if (!/^[a-zA-Z0-9-]{10,80}$/.test(eventId)) throw new HttpError(400, 'Invalid event ID.')
    if (!['interview-start', 'page-hidden', 'page-visible', 'window-blur', 'window-focus', 'camera-on', 'camera-off', 'camera-exception', 'meeting-tab-warning', 'meeting-camera-warning', 'meeting-held', 'meeting-resumed', 'meeting-ended', 'answer-timeout', ...CAMERA_EVENT_TYPES].includes(req.body.type)) throw new HttpError(400, 'Unsupported activity event.')
    const details = CAMERA_EVENT_TYPES.includes(req.body.type) ? cameraEventDetails(db, session, req.body.type, req.body.details) : {}
    const lateCameraSummary = ['face-missing','head-turned','hands-out-of-frame','phone-visible'].includes(req.body.type) && session.status === 'completed' && Date.now() - Date.parse(session.completed_at) <= 10000 && details.questionNumber === db.prepare('SELECT COUNT(*) AS n FROM answers WHERE session_id = ?').get(session.id).n
    if ((session.status === 'active' || lateCameraSummary) && db.prepare('SELECT COUNT(*) AS n FROM activity_events WHERE session_id = ?').get(session.id).n < 500) {
      db.prepare('INSERT OR IGNORE INTO activity_events (id, session_id, type, created_at, details) VALUES (?, ?, ?, ?, ?)').run(eventId, session.id, req.body.type, now(), JSON.stringify(details))
    }
    res.json(activityView(db, session.id))
  })
  app.post('/api/sessions/:id/language', lock(req => `session:${req.params.id}`, async (req, res) => {
    const session = getSession(db, req.params.id)
    const language = req.body.language
    if (!Object.hasOwn(languages, language)) throw new HttpError(400, 'Unsupported language.')
    if (session.status !== 'active' || session.language === language) return res.json(sessionView(db, session.id))
    const source = session.bank.map(question => ({ ...question, text: question.originalText || question.text }))
    const bank = (await ai.translateQuestions(source, language)).map((question, index) => ({ ...question, originalText: source[index].text }))
    const currentSource = session.current.originalText || session.current.text
    const current = bank.find(question => question.id === session.current.id)
      || { ...(await ai.translateQuestions([{ ...session.current, text: currentSource }], language))[0], originalText: currentSource }
    db.prepare('UPDATE sessions SET language = ?, bank = ?, current = ? WHERE id = ?').run(language, JSON.stringify(bank), JSON.stringify(current), session.id)
    res.json(sessionView(db, session.id))
  }))
  installInterviewLifecycle(app,db,ai,busy)
  app.post('/api/sessions/:id/skip-defence', lock(req => `session:${req.params.id}`, async (req, res) => {
    const session = getSession(db, req.params.id)
    if (session.status === 'active') db.prepare("UPDATE sessions SET status = 'reporting', defence_skipped = 1, current = '{}', question_started_at = NULL, response_ended_at = NULL WHERE id = ?").run(session.id)
    else if (!session.defence_skipped) throw new HttpError(409, 'This defence is already finished.')
    if (getSession(db, session.id).status === 'reporting') {
      try { await finalizeReport(db, ai, session.id) }
      catch (error) { return res.json({ ...sessionView(db, session.id), reportError: error.message }) }
    }
    res.json(sessionView(db, session.id))
  }))
  app.post('/api/sessions/:id/present', (req, res) => {
    const session = getSession(db, req.params.id)
    requireCurrent(session, req.body.questionId)
    if (!session.question_started_at) db.prepare('UPDATE sessions SET question_started_at = ? WHERE id = ?').run(now(), session.id)
    res.json(sessionView(db, session.id))
  })
  app.post('/api/sessions/:id/response-ended', (req, res) => {
    const session = getSession(db, req.params.id)
    if(!(['active','held'].includes(session.status)&&session.current.id===req.body.questionId))throw new HttpError(409,'This response is no longer current.')
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
  app.post('/api/sessions/:id/more-time', lock(req => `session:${req.params.id}`, (req, res) => {
    const session = getSession(db, req.params.id)
    requireCurrent(session, req.body.questionId)
    if(readMeeting(session).enabled)throw new HttpError(409,'Meeting response windows are fixed for this turn.')
    if (session.response_ended_at) throw new HttpError(409, 'The response time is already saved.')
    const duration = Math.min(300, session.duration + 15)
    db.prepare('UPDATE sessions SET duration = ?, current = ? WHERE id = ?').run(duration, JSON.stringify({ ...session.current, durationSeconds: duration }), session.id)
    res.json(sessionView(db, session.id))
  }))
  app.post('/api/sessions/:id/answers', lock(req => `session:${req.params.id}`, async (req, res) => {
    enforceMeetingDeadline(db,req.params.id)
    const session = getSession(db, req.params.id)
    const duplicate = db.prepare('SELECT id FROM answers WHERE session_id = ? AND question_id = ?').get(session.id, req.body.questionId || '')
    if (duplicate) return res.json(sessionView(db, session.id))
    requireCurrent(session, req.body.questionId)
    if (!session.question_started_at) throw new HttpError(409, 'Listen to or reveal the question before answering.')
    const transcript = typeof req.body.transcript === 'string' ? req.body.transcript.trim() : ''
    if (transcript.length > 12000) throw new HttpError(400, 'Please keep your answer under 12,000 characters.')
    if (!transcript && req.body.skip !== true) throw new HttpError(400, 'Record or type an answer, or choose Skip question.')
    const kind=responseKind(transcript)
    const academicTranscript=kind==='none'?'':transcript
    const method = ['voice', 'text', 'skipped'].includes(req.body.method) ? req.body.method : 'text'
    const endedAt = session.response_ended_at || now()
    // Persist before the provider call so retry latency never changes the recorded response time.
    if (!session.response_ended_at) db.prepare('UPDATE sessions SET response_ended_at = ? WHERE id = ?').run(endedAt, session.id)
    const seconds = Math.max(0, (Date.parse(endedAt) - Date.parse(session.question_started_at)) / 1000)
    if(readMeeting(session).enabled){ const meeting=readMeeting(session);meeting.draft={questionId:session.current.id,text:transcript,at:now()};db.prepare('UPDATE sessions SET meeting = ? WHERE id = ?').run(JSON.stringify(meeting),session.id) }
    const answers = db.prepare('SELECT * FROM answers WHERE session_id = ? ORDER BY position').all(session.id)
    let pairAssessment = null
    let originalAnswer = null
    let originalAssessment = null
    let evaluation
    if (session.challenge_mode === 'transfer') {
      if (session.current.stage === 'explain') {
        originalAssessment = kind === 'answer'
          ? await ai.assessTransferOriginal(session.current.pairSpec, transcript, session.mode, session.language)
          : { explanationScore: 0, originalQuote: '', explanationRationale: kind === 'unknown' ? 'The student said they did not know.' : 'No substantive answer was captured.' }
        const skipApplication = originalAssessment.explanationScore === 0
        evaluation = { status: responseStatus(originalAssessment.explanationScore), explanation: originalAssessment.explanationRationale,
          evidenceQuote: originalAssessment.originalQuote, skipApplication,
          feedback: skipApplication ? (kind === 'answer' ? originalAssessment.feedback || '' : conversationLead({ count: answers.length + 1, kind, language: session.language })) : '' }
        if (skipApplication) pairAssessment = skippedTransferAssessment(session.current.pairSpec, originalAssessment)
      }
      else {
        const originalQuestion = session.bank.find(q => q.pairId === session.current.pairId && q.stage === 'explain')
        originalAnswer = answers.find(a => a.question_id === originalQuestion.id)
        if (!originalAnswer) throw new HttpError(409, 'Record the original response before attempting the changed scenario.')
        pairAssessment = await ai.assessTransferPair(session.current.pairSpec, responseKind(originalAnswer.transcript)==='none'?'':originalAnswer.transcript, academicTranscript, session.mode,session.language,JSON.parse(originalAnswer.rubric || '{}').originalAssessment || null)
        evaluation = { status: responseStatus(pairAssessment.transferScore), explanation: pairAssessment.transferRationale, evidenceQuote: pairAssessment.transferQuote }
      }
    } else evaluation = kind==='answer' ? await ai.evaluate(session.analysis, session.current, transcript, session.mode, session.language, []) : {
      status: 'UNCLEAR', explanation: kind==='unknown'?'The student said they did not know. No explanation of the concept was supplied.':'No substantive answer was captured for this question.', followUp: 'Explain this concept simply.'
    }
    const unrelatedCandidate=kind==='answer'&&(session.challenge_mode==='transfer'?(originalAssessment?.explanationScore===0||pairAssessment?.transferScore===0):evaluation.addressesQuestion==='no'||session.mode==='demo'&&evaluation.status==='UNCLEAR')&&!evaluation.assessmentDirectivesIgnored
    const topic=unrelatedCandidate&&ai.classifyOffTopic?await ai.classifyOffTopic(session.current,transcript,session.analysis,session.language):{offTopic:false,aside:''}
    const offTopicCount=answers.filter(a=>JSON.parse(a.rubric||'{}').offTopic===true).length+(topic.offTopic?1:0)
    if(topic.offTopic){
      evaluation.status='UNCLEAR';evaluation.offTopic=true
      if(originalAssessment){originalAssessment.explanationScore=0;originalAssessment.offTopic=true;evaluation.skipApplication=true;pairAssessment=skippedTransferAssessment(session.current.pairSpec,originalAssessment)}
      if(pairAssessment&&session.current.stage==='apply'){pairAssessment.transferScore=0;pairAssessment.consistencyScore=pairAssessment.explanationScore>0?0:null;pairAssessment.offTopic=true}
    }
    if(getSession(db,session.id).status==='held' || (readMeeting(getSession(db,session.id)).epoch||0)!==(readMeeting(session).epoch||0))return res.json(sessionView(db,session.id))
    const answer = { concept: session.current.concept, question: session.current.text, transcript }
    let next = nextQuestion(session, [...answers, answer], evaluation)
    let updatedBank=session.bank
    if(session.challenge_mode!=='transfer'&&kind!=='answer')evaluation.feedback=conversationLead({count:answers.length+1,kind,language:session.language})
    if(pairAssessment?.feedback)evaluation.feedback=pairAssessment.feedback
    if(topic.offTopic){
      evaluation.feedback=offTopicFeedback({count:offTopicCount,aside:topic.aside,language:session.language})
      const seriousMarker=session.language==='en'?' But ':' '+({hu:'Kérlek,',fr:'Merci de',ar:'يرجى'}[session.language]||'But ')
      const boundary=evaluation.feedback.indexOf(seriousMarker)
      if(boundary>0)evaluation.speechDelivery={kind:'off-topic',playfulPrefix:evaluation.feedback.slice(0,boundary)}
    }
    if(evaluation.feedback&&(kind==='answer'||!next)){
      const endings={en:next?"Let's try the next question.":"That's the last question. Thanks for taking part.",fr:next?'Passons à la question suivante.':'C’était la dernière question. Merci.',hu:next?'Nézzük a következő kérdést.':'Ez volt az utolsó kérdés. Köszönöm.',ar:next?'لننتقل إلى السؤال التالي.':'هذا هو السؤال الأخير. شكراً لك.'}
      evaluation.feedback=evaluation.feedback.replace(/(?:Let's (?:move on|try the next question|move to the next question)|That(?:'s| is) okay;? let(?:'s| us) move on)[.!]*/gi,'').trim()
      evaluation.feedback+=' '+(endings[session.language]||endings.en)
    }
    if(next&&kind==='answer'&&session.challenge_mode==='transfer'&&next.stage==='apply'&&!next.pairSpec?.fixedQuestionSet){
      next=await ai.adaptInterviewQuestion(session.analysis,next,session.current,transcript,answers)
      updatedBank=session.bank.map(q=>q.pairId===next.pairId?{...(q.id===next.id?next:q),pairSpec:next.pairSpec}:q)
    }
    if(getSession(db,session.id).status==='held'||(readMeeting(getSession(db,session.id)).epoch||0)!==(readMeeting(session).epoch||0))return res.json(sessionView(db,session.id))
    if (next && (next.source === 'adaptive'||next.adaptation)) {
      const originalText = next.text
      if (session.language !== 'en') next = (await ai.translateQuestions([next], session.language))[0]
      next = { ...next, originalText }
    }
    if (next) next = readMeeting(session).enabled ? { ...next, durationSeconds: meetingQuestionDuration(next) } : withQuestionTiming(next, session.timing_mode, session.base_duration)
    transaction(db, () => {
      db.prepare(`INSERT INTO answers (id, session_id, question_id, position, question, concept, source, transcript, method, status, explanation, question_started_at, response_ended_at, response_seconds, timer_expired, evidence_quote, rubric) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        id(), session.id, session.current.id, answers.length + 1, session.current.text, session.current.concept, session.current.source,
        transcript, transcript ? method : 'skipped', evaluation.status, evaluation.explanation,
        session.question_started_at, endedAt, seconds, Number(seconds >= session.duration), evaluation.evidenceQuote || '',
        JSON.stringify({ responseKind:kind,offTopic:Boolean(topic.offTopic),speechDelivery:evaluation.speechDelivery||null,offTopicCount,flaggedForTeacher:topic.offTopic&&offTopicCount>=2, feedback:evaluation.feedback||'', score:session.challenge_mode==='transfer'?(originalAssessment?.explanationScore ?? pairAssessment?.transferScore ?? null):evaluation.status==='DEMONSTRATED'?2:evaluation.status==='PARTIAL'?1:0, maxScore:2, questionAdaptation:session.current.adaptation||null, timeGuideSeconds: session.duration, timingMode: session.timing_mode, ...(session.challenge_mode === 'transfer' ? { originalAssessment, applicationSkipped: Boolean(evaluation.skipApplication), stage: session.current.stage, pairId: session.current.pairId, pairIndex: session.current.pairIndex } : evaluation.accuracy ? { addressesQuestion: evaluation.addressesQuestion, accuracy: evaluation.accuracy, reasoning: evaluation.reasoning, application: evaluation.application, assessmentDirectivesIgnored: Boolean(evaluation.assessmentDirectivesIgnored) } : {}) }),
      )
      const meeting=readMeeting(getSession(db,session.id));if(meeting.enabled&&meeting.draft?.questionId===session.current.id){meeting.draft=null;db.prepare('UPDATE sessions SET meeting = ? WHERE id = ?').run(JSON.stringify(meeting),session.id)}
      if (pairAssessment) {
        db.prepare('INSERT INTO transfer_assessments VALUES (?, ?, ?, ?)').run(session.id, session.current.pairId, JSON.stringify(pairAssessment), now())
        if (pairAssessment.assessmentState === 'complete') db.prepare('UPDATE answers SET status = ?, explanation = ?, evidence_quote = ? WHERE id = ?')
          .run(responseStatus(pairAssessment.explanationScore), pairAssessment.explanationRationale, pairAssessment.originalQuote, originalAnswer.id)
        if(pairAssessment.assessmentState==='complete')db.prepare('UPDATE answers SET rubric=? WHERE id=?').run(JSON.stringify({...JSON.parse(originalAnswer.rubric||'{}'),score:pairAssessment.explanationScore,maxScore:2}),originalAnswer.id)
      }
      db.prepare('UPDATE sessions SET bank = ? WHERE id = ?').run(JSON.stringify(updatedBank),session.id)
      db.prepare('UPDATE sessions SET current = ?, status = ?, duration = ?, question_started_at = NULL, response_ended_at = NULL WHERE id = ?')
        .run(JSON.stringify(next || {}), next ? 'active' : 'reporting', next?.durationSeconds || session.base_duration, session.id)
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
  function readReport(reportId) {
    const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(reportId)
    if (!report) throw new HttpError(404, 'Report not found.')
    const session = getSession(db, report.session_id)
    const answers = db.prepare('SELECT * FROM answers WHERE session_id = ? ORDER BY position').all(session.id)
    const parentReport = session.parent_session_id ? db.prepare('SELECT id, concept_evidence FROM reports WHERE session_id = ?').get(session.parent_session_id) : null
    const child = db.prepare('SELECT s.id, s.status, s.bank, r.id AS report_id FROM sessions s LEFT JOIN reports r ON r.session_id = s.id WHERE s.parent_session_id = ?').get(session.id)
    return { ...report,offTopicSummary:offTopicSummary(answers.map(a=>({...a,rubric:JSON.parse(a.rubric||'{}')}))), evidenceReceipt: evidenceReceipt(db, report.id), strengths: JSON.parse(report.strengths), reviewAreas: JSON.parse(report.review_areas),
      gradingResult: numericSuggestedGrade(JSON.parse(report.grading_result || 'null')), gradeReview: JSON.parse(report.grade_review || 'null'), challengeMode: session.challenge_mode, transferSummary: JSON.parse(report.transfer_summary),
      conceptEvidence: JSON.parse(report.concept_evidence), expectedConcepts: session.parent_session_id ? [...new Set(session.bank.map(q => q.concept))] : session.assignmentConcepts,
      availableFollowUpConcepts: [...new Set(session.bank.map(q => q.concept))],
      isFollowUp: Boolean(session.parent_session_id), previousReportId: parentReport?.id || null, previousConceptEvidence: parentReport ? JSON.parse(parentReport.concept_evidence) : [],
      followUpConcepts: child ? [...new Set(JSON.parse(child.bank).map(q => q.concept))] : [], followUpSessionId: child?.id || null, followUpStatus: child?.status || null, followUpReportId: child?.report_id || null, activity: activityView(db, session.id), submittedText: session.submitted_text, showcaseKind: session.showcase_kind, responseSeconds: session.duration,
      language:session.language, student: session.student, assignmentTitle: session.assignment_title, assignmentId: session.assignment_id,
      meeting: readMeeting(session), filename: session.filename, defenceSkipped: Boolean(session.defence_skipped), answers: answers.map(a => ({ ...a, rubric: JSON.parse(a.rubric), timer_expired: Boolean(a.timer_expired) })), analysis: session.analysis,
    }
  }
  const reportLanguage=(req,report)=>req.query.language==='hu'?'hu':req.query.language==='en'?'en':report.language==='hu'?'hu':'en'
  app.get('/api/reports/:id',async(req,res)=>{const report=readReport(req.params.id);res.json(await localizeReport(report,reportLanguage(req,report)))})
  app.get('/api/reports/:id/download',async(req,res)=>{
    const original=readReport(req.params.id)
    const report=await localizeReport(original,reportLanguage(req,original))
    const pdf=await renderReportPdf(report)
    const filename='merit-lens-report-'+report.id.replace(/[^a-zA-Z0-9-]/g,'')+'.pdf'
    res.set({'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="'+filename+'"','Cache-Control':'no-store'})
    res.send(pdf)
  })

  app.post('/api/reports/:id/grade',lock(req=>'grade:'+req.params.id,async(req,res)=>{
    const report=db.prepare('SELECT * FROM reports WHERE id=?').get(req.params.id);if(!report)throw new HttpError(404,'Report not found.')
    const session=getSession(db,report.session_id)
    const assignment=session.analysis.assignmentSnapshot?.rubric?.length?session.analysis.assignmentSnapshot:getAssignment(db,session.assignment_id)
    const result=await ai.assessSubmission(session.submitted_text,assignment,req.body.language==='hu'?'hu':'en')
    if(result.status==='unavailable')throw new HttpError(400,result.reason)
    db.prepare('UPDATE reports SET grading_result=?, grade_review=? WHERE id=?').run(JSON.stringify(result),'null',report.id)
    res.json(result)
  }))
  app.post('/api/reports/:id/grade-review',(req,res)=>{
    const report=db.prepare('SELECT * FROM reports WHERE id=?').get(req.params.id);if(!report)throw new HttpError(404,'Report not found.')
    const grade=numericSuggestedGrade(JSON.parse(report.grading_result||'null'));if(!grade?.criteria)throw new HttpError(409,'Analyze the submitted work first.')
    if(req.body.approved!==true)throw new HttpError(400,'Confirm that you reviewed the submitted work and criteria.')
    const notes=requiredText(req.body.notes,'Grading feedback',8000)
    if(typeof req.body.release!=='boolean')throw new HttpError(400,'Choose whether to publish this grade.')
    const scores=req.body.scores;if(!Array.isArray(scores)||scores.length!==grade.criteria.length)throw new HttpError(400,'Review every criterion.')
    const criteria=grade.criteria.map((c,i)=>{const score=scores[i];if(typeof score!=='number'||!Number.isFinite(score)||score<0||score>c.maxPoints)throw new HttpError(400,'Criterion points must be within the stated maximum.');return{...c,score}})
    const review={criteria,score:Math.round(criteria.reduce((n,c)=>n+c.score,0)*100)/100,total:grade.total,notes,approvedAt:now(),releasedAt:req.body.release?now():null}
    db.prepare('UPDATE reports SET grade_review=? WHERE id=?').run(JSON.stringify(review),report.id);res.json(review)
  })
  app.get('/api/reports/:id/receipt', async (req, res) => {
    const receipt = evidenceReceipt(db, req.params.id, true)
    if (!receipt) throw new HttpError(404, 'Report not found.')
    const filename='merit-lens-record-'+req.params.id.replace(/[^a-zA-Z0-9-]/g,'')
    if(req.query.format==='text'){
      res.set('Content-Disposition','attachment; filename="'+filename+'.txt"')
      const original=readReport(req.params.id)
      const report=await localizeReport(original,reportLanguage(req,original))
      return res.type('text/plain').send(renderEvidenceText(receipt,report.displayLanguage,report))
    }
    res.set('Content-Disposition','attachment; filename="'+filename+'.json"')
    res.type('application/json').send(JSON.stringify(receipt,null,2)+'\n')
  })
  app.post('/api/reports/:id/follow-up', lock(req => 'follow-up:' + req.params.id, async (req, res) => {
    const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(req.params.id)
    if (!report) throw new HttpError(404, 'Report not found.')
    const previous = getSession(db, report.session_id)
    const existing = db.prepare('SELECT id FROM sessions WHERE parent_session_id = ?').get(previous.id)
    if (existing) return res.json(sessionView(db, existing.id))
    const available = [...new Set(previous.bank.map(q => q.concept))]
    const findings = JSON.parse(report.concept_evidence)
    const recommended = findings.filter(c => c.status !== 'DEMONSTRATED').map(c => c.concept)
    const concepts = req.body.concepts === undefined ? (recommended.length ? recommended : available.slice(0, 3)) : parseConcepts(req.body.concepts)
    if (!concepts.length || concepts.length > 3 || concepts.some(c => !available.includes(c))) throw new HttpError(400, 'Choose one to three concepts from this interview for the follow-up.')
    const bank = previous.bank.filter(q => concepts.includes(q.concept) && q.stage !== 'apply').map(q => ({ id: id(), concept: q.concept, text: q.text, originalText: q.originalText, expectedAnswer:q.expectedAnswer, independent:true, source: q.source === 'transfer-explain' ? 'source-guided' : q.source }))
    const timedBank = bank.map(question => withQuestionTiming(question, previous.timing_mode, previous.duration))
    const sessionId = id()
    db.prepare("INSERT INTO sessions (id, submission_id, status, bank, current, created_at, language, duration, parent_session_id, timing_mode, base_duration) VALUES (?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(sessionId, previous.submission_id, JSON.stringify(timedBank), JSON.stringify(timedBank[0]), now(), previous.language, timedBank[0].durationSeconds || previous.duration, previous.id, previous.timing_mode, previous.base_duration)
    res.status(201).json(sessionView(db, sessionId))
  }))
  app.patch('/api/reports/:id/review', (req, res) => {
    const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(req.params.id)
    if (!report) throw new HttpError(404, 'Report not found.')
    const status = req.body.status
    if (!['pending', 'reviewed', 'follow-up'].includes(status)) throw new HttpError(400, 'Choose a valid review decision.')
    const notes = optionalText(req.body.notes, 'Teacher notes', 8000)
    const feedback = optionalText(req.body.feedback, 'Student feedback', 8000)
    if (req.body.release !== undefined && typeof req.body.release !== 'boolean') throw new HttpError(400, 'Release must be true or false.')
    if (req.body.release && status === 'pending') throw new HttpError(400, 'Review the evidence before releasing feedback.')
    if (req.body.release && !feedback) throw new HttpError(400, 'Write feedback for the student before releasing it.')
    db.prepare('UPDATE reports SET review_status = ?, teacher_notes = ?, feedback = ?, reviewed_at = ?, released_at = ? WHERE id = ?')
      .run(status, notes, feedback, status === 'pending' ? null : now(), req.body.release ? (report.released_at || now()) : null, report.id)
    res.json({ saved: true })
  })
  app.get('/api/sessions/:id/feedback', (req, res) => {
    const session = getSession(db, req.params.id)
    const report = db.prepare('SELECT review_status, feedback, released_at, grade_review FROM reports WHERE session_id = ?').get(session.id)
    // This student view deliberately excludes private teacher notes and unreleased AI findings.
    const followUp = db.prepare('SELECT id FROM sessions WHERE parent_session_id = ?').get(session.id)
    const grade=report?.grade_review?JSON.parse(report.grade_review):null
    res.json(report?.released_at||grade?.releasedAt ? { grade:grade?.releasedAt?{score:grade.score,total:grade.total,feedback:grade.notes}:null, available: true, status:grade?.releasedAt?'reviewed':report.review_status, feedback:report.released_at?report.feedback:'', releasedAt:report.released_at||grade?.releasedAt, followUpSessionId: followUp?.id || null }
      : { available: false })
  })

  app.post('/api/sessions/:id/avatar', (req, res) => {
    const session = getSession(db, req.params.id)
    requireCurrent(session, req.body.questionId)
    if (req.body.retry !== undefined && typeof req.body.retry !== 'boolean') throw new HttpError(400, 'Retry must be true or false.')
    res.json(avatar.start(session, req.body.retry === true))
  })
  app.get('/api/sessions/:id/avatar', async (req, res) => {
    const session = getSession(db, req.params.id)
    requireCurrent(session, req.query.questionId)
    res.json(await avatar.status(session))
  })

  app.post('/api/sessions/:id/speech', lock(req => `speech:${req.params.id}`, async (req, res) => {
    const session = getSession(db, req.params.id)
    if(req.body.feedback===true){
      const last=db.prepare('SELECT question_id,rubric FROM answers WHERE session_id=? ORDER BY position DESC LIMIT 1').get(session.id)
      const rubric=JSON.parse(last?.rubric||'{}'),feedback=rubric.feedback
      if(!feedback||last.question_id!==req.body.questionId)throw new HttpError(409,'Feedback is unavailable for this answer.')
      return res.type('audio/mpeg').send(await synthesizeSpeech(config,feedback,request,{delivery:rubric.speechDelivery}))
    }
    requireCurrent(session, req.body.questionId)
    const audio = await audioFor(session,req.body.questionOnly===true)
    res.type('audio/mpeg').send(audio)
  }))
  app.post('/api/sessions/:id/transcribe', upload.single('audio'), lock(req => `transcribe:${req.params.id}`, async (req, res) => {
    const session = getSession(db, req.params.id)
    if(!(['active','held'].includes(session.status)&&session.current.id===req.body.questionId))throw new HttpError(409,'This recording is no longer current.')
    if (!req.file || !/^(audio\/|video\/webm)/.test(req.file.mimetype)) throw new HttpError(400, 'Send a recorded audio file.')
    const text = await transcribeAudio(config, req.file, session.language, request)
    const latest=getSession(db,session.id),meeting=readMeeting(latest)
    if(meeting.enabled&&['active','held'].includes(latest.status)&&latest.current.id===req.body.questionId){const previous=meeting.draft?.questionId===req.body.questionId?meeting.draft.text:'';meeting.draft={questionId:req.body.questionId,text:previous?previous+' '+text:text,at:now()};db.prepare('UPDATE sessions SET meeting = ? WHERE id = ?').run(JSON.stringify(meeting),session.id)}
    res.json({ text })
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
  if(readMeeting(session).warning==='speaker-mismatch')throw new HttpError(409,'The speaker check is paused. Resume the meeting before answering.')
  if (session.status !== 'active' || session.current.id !== questionId) throw new HttpError(409, 'This question is no longer current. Refresh to resume your session.')
}
function parseConcepts(value) {
  if (!Array.isArray(value) || value.length > 12) throw new HttpError(400, 'Provide up to 12 core concepts.')
  return [...new Set(value.map(v => requiredText(v, 'Core concept', 160)))]
}

function parseChallengeConcepts(value,count) {
  const concepts=parseConcepts(value)
  if(concepts.length>count)throw new HttpError(400,'Enter at most '+count+' concepts, or increase Concepts to test.')
  return concepts
}

function parseTimingMode(value) {
  if (!['adaptive', 'fixed'].includes(value)) throw new HttpError(400, 'Choose adaptive or fixed question timing.')
  return value
}
function parseDuration(value) {
  if (!RESPONSE_TIME_OPTIONS.includes(value)) throw new HttpError(400, 'Choose a supported response time between 20 seconds and 5 minutes.')
  return value
}
function optionalText(value, label, max) {
  if (typeof value !== 'string' || value.length > max) throw new HttpError(400, label + ' must be text under ' + max + ' characters.')
  return value.trim()
}


function publicAssignment({reference_answer,...assignment}) { return assignment }

function assignmentChallenge(mode,count) {
 if(!['standard','transfer'].includes(mode))throw new HttpError(400,'Choose standard or understanding transfer.')
 const number=Number(count);if(![2,3].includes(number))throw new HttpError(400,'Choose two or three concepts.')
 return{mode,count:number}
}

function parseQuestionLimit(value){const n=Number(value);if(n!==6)throw new HttpError(400,'Standard oral defence uses up to 6 questions.');return n}
