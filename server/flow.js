import { id, now, transaction } from './db.js'
import { HttpError } from './extract.js'
import { genericQuestions } from './ai.js'

export function getAssignment(db, assignmentId) {
  const row = db.prepare('SELECT * FROM assignments WHERE id = ?').get(assignmentId)
  if (!row) throw new HttpError(404, 'Assignment not found.')
  return { ...row, concepts: JSON.parse(row.concepts) }
}

export function getSession(db, sessionId) {
  const row = db.prepare(`SELECT s.*, u.analysis, u.mode, u.student, u.filename, u.assignment_id,
    a.title AS assignment_title FROM sessions s JOIN submissions u ON u.id = s.submission_id
    JOIN assignments a ON a.id = u.assignment_id WHERE s.id = ?`).get(sessionId)
  if (!row) throw new HttpError(404, 'Session not found.')
  return { ...row, current: JSON.parse(row.current), bank: JSON.parse(row.bank), analysis: JSON.parse(row.analysis) }
}

export function sessionView(db, sessionId) {
  const session = getSession(db, sessionId)
  const count = db.prepare('SELECT COUNT(*) AS count FROM answers WHERE session_id = ?').get(sessionId).count
  const report = db.prepare('SELECT id FROM reports WHERE session_id = ?').get(sessionId)
  return { id: session.id, status: session.status, student: session.student, assignmentId: session.assignment_id,
    assignmentTitle: session.assignment_title, filename: session.filename, mode: session.mode,
    question: session.status === 'active' ? session.current : null, questionNumber: count + 1,
    answered: count, maxQuestions: 6, duration: session.duration,
    questionStartedAt: session.question_started_at, responseEndedAt: session.response_ended_at,
    reportId: report?.id || null,
  }
}

export function makeBank(analysis, approved) {
  const generated = analysis.questions.length ? analysis.questions : genericQuestions
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
  for (const q of generated) if (!bank.some(item => item.concept === q.concept)) bank.push({ ...q, id: id(), source: analysis.questions.length ? 'generated' : 'generic' })
  return bank
}

export function nextQuestion(session, answers, evaluation) {
  const count = answers.length
  const checked = new Set(answers.map(a => a.concept))
  const target = Math.min(3, new Set(session.bank.map(q => q.concept)).size)
  if (count >= 6 || (count >= 3 && checked.size >= target)) return null
  const sameConceptCount = answers.filter(a => a.concept === session.current.concept).length
  const remaining = session.bank.filter(q => !checked.has(q.concept))
  // One adaptive follow-up per concept before moving on; always prefer a relevant approved bank question.
  if (sameConceptCount < 2 || !remaining.length) {
    const approved = session.bank.find(q => q.source === 'teacher-approved' && q.concept === session.current.concept && !answers.some(a => a.question === q.text))
    return approved || { id: id(), concept: session.current.concept, text: evaluation.followUp, source: 'adaptive' }
  }
  return remaining[0]
}

export async function finalizeReport(db, ai, sessionId) {
  const existing = db.prepare('SELECT id FROM reports WHERE session_id = ?').get(sessionId)
  if (existing) return existing.id
  const session = getSession(db, sessionId)
  if (session.status !== 'reporting') throw new HttpError(409, 'Finish the oral defence before generating a report.')
  const answers = db.prepare('SELECT * FROM answers WHERE session_id = ? ORDER BY position').all(sessionId)
  const result = await ai.report(answers, session.mode)
  const reportId = id()
  transaction(db, () => {
    db.prepare('INSERT INTO reports VALUES (?, ?, ?, ?, ?, ?, ?)').run(reportId, sessionId, result.summary, JSON.stringify(result.strengths), JSON.stringify(result.reviewAreas), session.mode, now())
    db.prepare("UPDATE sessions SET status = 'completed', completed_at = ? WHERE id = ?").run(now(), sessionId)
  })
  return reportId
}
