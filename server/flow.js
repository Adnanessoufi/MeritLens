import { conversationLead, responseKind, safeConversationReaction } from '../shared/conversation.js'
import { meetingQuestionDuration } from '../shared/meeting-timer.js'
import { publicQuestion, transferReport, responseStatus } from './transfer.js'
import { id, now, transaction } from './db.js'
import { sealReport } from './evidence.js'
import { HttpError } from './extract.js'
import { genericQuestions } from './ai.js'

export function getAssignment(db, assignmentId) {
  const row = db.prepare('SELECT * FROM assignments WHERE id = ?').get(assignmentId)
  if (!row) throw new HttpError(404, 'Assignment not found.')
  return { ...row, concepts: JSON.parse(row.concepts), challenge_concepts: JSON.parse(row.challenge_concepts || '[]'), rubric: JSON.parse(row.rubric || '[]') }
}

export function getSession(db, sessionId) {
  const row = db.prepare(`SELECT s.*, u.analysis, u.mode, u.student, u.filename, u.assignment_id, u.text AS submitted_text, u.showcase_kind,
    a.title AS assignment_title, a.concepts AS assignment_concepts FROM sessions s JOIN submissions u ON u.id = s.submission_id
    JOIN assignments a ON a.id = u.assignment_id WHERE s.id = ?`).get(sessionId)
  if (!row) throw new HttpError(404, 'Session not found.')
  return { ...row, current: JSON.parse(row.current), bank: JSON.parse(row.bank), analysis: JSON.parse(row.analysis), assignmentConcepts: JSON.parse(row.assignment_concepts) }
}

export function sessionView(db, sessionId) {
  const session = getSession(db, sessionId)
  const count = db.prepare('SELECT COUNT(*) AS count FROM answers WHERE session_id = ?').get(sessionId).count
  const skippedApplications = session.challenge_mode === 'transfer' ? db.prepare('SELECT result FROM transfer_assessments WHERE session_id = ?').all(sessionId).filter(row => JSON.parse(row.result).assessmentState === 'skipped').length : 0
  const report = db.prepare('SELECT id FROM reports WHERE session_id = ?').get(sessionId)
  const previousAnswer=db.prepare('SELECT transcript, rubric FROM answers WHERE session_id = ? ORDER BY position DESC LIMIT 1').get(sessionId)
  const previous=previousAnswer?.transcript||''
  const previousRubric=JSON.parse(previousAnswer?.rubric||'{}')
  const kind=previousAnswer?previousRubric.responseKind||responseKind(previous):'none'
  const feedback=previousRubric.feedback||''
  const reaction=count>0&&kind==='answer'&&session.language==='en'?safeConversationReaction(session.current?.conversationReaction):''
  const lead=feedback||reaction||conversationLead({count,previous,stage:session.current?.stage,adaptive:session.current?.source==='adaptive',language:session.language,kind})
  return { lastAnswerDelivery:previousRubric.speechDelivery||null,lastAnswerFeedback:feedback, conversationLead:lead, spokenQuestionText:lead+' '+(session.current?.text||''), meetingQuestionSeconds: meetingQuestionDuration(session.current), meeting: JSON.parse(session.meeting || '{}'), id: session.id, status: session.status, student: session.student, assignmentId: session.assignment_id,
    assignmentTitle: session.assignment_title, filename: session.filename, mode: session.mode,
    question: ['active','held'].includes(session.status) ? publicQuestion(session.current) : null, questionNumber: count + 1,
    answered: count, maxQuestions: session.challenge_mode === 'transfer' ? session.bank.length - skippedApplications : Math.min(6,session.bank.length),
    challengeMode: session.challenge_mode, pairCount: session.challenge_mode === 'transfer' ? session.bank.length / 2 : 0, duration: session.duration, timingMode: session.timing_mode, language: session.language,
    defenceSkipped: Boolean(session.defence_skipped), parentSessionId: session.parent_session_id,
    focusConcepts: [...new Set(session.bank.map(q => q.concept))],
    questionStartedAt: session.question_started_at, responseEndedAt: session.response_ended_at,
    reportId: report?.id || null,
  }
}

export function makeBank(analysis, approved) {
  const generated = analysis.questions.length ? analysis.questions : analysis.concepts.length?analysis.concepts.map(c=>({concept:c.name,text:'In your work you wrote "'+c.evidence.trim().slice(0,110)+'". What does this do?',source:'source-guided'})):genericQuestions
  const concepts = analysis.concepts.map(c => c.name.toLowerCase())
  const tokens = value => value.toLowerCase().match(/[a-z]{4,}/g) || []
  const relevant = approved.filter(q => concepts.length && concepts.some(c => c === q.concept.toLowerCase()
    || tokens(q.concept).some(t => c.includes(t.slice(0, -1)))
    || analysis.concepts.some(item => tokens(q.concept).some(t => item.evidence.toLowerCase().includes(t.slice(0, -1))))))
  const bank = relevant.map(q => {
    const match = analysis.concepts.find(c => c.name.toLowerCase() === q.concept.toLowerCase()
      || tokens(q.concept).some(t => c.name.toLowerCase().includes(t.slice(0, -1))))
    return { id: id(), text: q.text, concept: match?.name || q.concept, source: 'teacher-approved' }
  })
  for (const q of generated) if (!bank.some(item => item.concept === q.concept)) bank.push({ ...q, id: id(), source: q.source || (analysis.questions.length ? 'generated' : 'generic') })
  return bank.slice(0,6).map(q=>({...q,independent:true}))
}

export function nextQuestion(session, answers, evaluation) {
  const count = answers.length
  if (session.challenge_mode === 'transfer') {
    const currentIndex = session.bank.findIndex(q => q.id === session.current.id)
    if (currentIndex < 0) throw new HttpError(409, 'The current transfer question is missing.')
    return session.bank[currentIndex + (session.current.stage === 'explain' && evaluation?.skipApplication ? 2 : 1)] || null
  }
  // Standard mode asks independent concepts; only transfer adapts within a pair.
  return count < Math.min(6,session.bank.length) ? session.bank[count] : null
}

export async function finalizeReport(db, ai, sessionId) {
  const existing = db.prepare('SELECT id FROM reports WHERE session_id = ?').get(sessionId)
  if (existing) return existing.id
  const session = getSession(db, sessionId)
  if (session.status !== 'reporting') throw new HttpError(409, 'Finish the oral defence before generating a report.')
  const answers = db.prepare('SELECT * FROM answers WHERE session_id = ? ORDER BY position').all(sessionId)
  const assessments = db.prepare('SELECT pair_id, result FROM transfer_assessments WHERE session_id = ?').all(sessionId).map(row => ({ pairId: row.pair_id, result: JSON.parse(row.result) }))
  const transfer = session.challenge_mode === 'transfer' ? transferReport(session, answers, assessments) : null
  const result = transfer ? { summary: transfer.summary, strengths: transfer.pairs.filter(p => p.status === 'STRONG').map(p => p.concept + (session.language==='hu'?': az alapelvet az új helyzetben is alkalmazta.':': the principle was applied under the change.')),
    reviewAreas: transfer.pairs.filter(p => p.status !== 'STRONG').map(p => p.concept + ': ' + p.nextStep),
    conceptEvidence: transfer.pairs.map(p => ({ concept: p.concept, status: responseStatus(p.transferScore), reasoning: p.assessmentState === 'skipped' ? p.explanationRationale + ' ' + p.transferRationale : p.transferRationale, evidencePositions: [p.originalPosition, p.applicationPosition].filter(Boolean), nextStep: p.nextStep })) } : session.defence_skipped || !answers.length
    ? { summary: session.defence_skipped ? 'The student skipped the oral defence. No conclusion about understanding can be drawn from the missing responses.' : 'The interview stopped before a complete response was saved. No conclusion about understanding can be drawn.', strengths: [], reviewAreas: [session.defence_skipped ? 'The oral defence was skipped. Review the assignment directly and follow up with the student if needed.' : 'No completed responses were saved. Review the interruption and submitted work directly.'], conceptEvidence: [] }
    : await ai.report(answers, session.mode, session.analysis, session.language==='hu'?'hu':'en')
  const reportId = id()
  transaction(db, () => {
    db.prepare('INSERT INTO reports (id, session_id, summary, strengths, review_areas, mode, created_at, concept_evidence) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(reportId, sessionId, result.summary, JSON.stringify(result.strengths), JSON.stringify(result.reviewAreas), session.mode, now(), JSON.stringify(result.conceptEvidence || []))
    if (session.analysis.workAssessment) db.prepare('UPDATE reports SET grading_result = ? WHERE id = ?').run(JSON.stringify(session.analysis.workAssessment), reportId)
    if (transfer) db.prepare('UPDATE reports SET transfer_summary = ? WHERE id = ?').run(JSON.stringify(transfer), reportId)
    db.prepare("UPDATE sessions SET status = 'completed', completed_at = ? WHERE id = ?").run(now(), sessionId)
  })
  sealReport(db, reportId)
  return reportId
}
