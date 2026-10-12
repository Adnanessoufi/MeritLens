import { createHash } from 'node:crypto'
import { now } from './db.js'

const hash = value => createHash('sha256').update(value).digest('hex')
function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']'
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}'
  return JSON.stringify(value)
}
function snapshot(db, reportId) {
  const report = db.prepare('SELECT r.*, s.submission_id, s.defence_skipped, u.text, u.student, u.filename, u.analysis FROM reports r JOIN sessions s ON s.id = r.session_id JOIN submissions u ON u.id = s.submission_id WHERE r.id = ?').get(reportId)
  if (!report) return null
  const answers = db.prepare('SELECT position, question, concept, source, transcript, method, status, explanation, evidence_quote, rubric, question_started_at, response_ended_at, response_seconds, timer_expired FROM answers WHERE session_id = ? ORDER BY position').all(report.session_id)
  const snapshot = { version: 'merit-lens-evidence-v1', reportId, sessionId: report.session_id, student: report.student, filename: report.filename,
    sourceText: report.text, sourceFingerprint: hash(report.text), analysis: JSON.parse(report.analysis), mode: report.mode, defenceSkipped: Boolean(report.defence_skipped),
    summary: report.summary, strengths: JSON.parse(report.strengths), reviewAreas: JSON.parse(report.review_areas), conceptEvidence: JSON.parse(report.concept_evidence),
    answers: answers.map(a => ({ ...a, rubric: JSON.parse(a.rubric) })) }
  if (report.transfer_summary && report.transfer_summary !== 'null') snapshot.transferChallenge = JSON.parse(report.transfer_summary)
  return snapshot
}
export function sealReport(db, reportId) {
  const saved = db.prepare('SELECT evidence_hash FROM reports WHERE id = ?').get(reportId)
  if (!saved || saved.evidence_hash) return
  const evidence = snapshot(db, reportId)
  db.prepare('UPDATE reports SET evidence_hash = ?, receipt_created_at = ? WHERE id = ?').run(hash(canonical(evidence)), now(), reportId)
}
export function evidenceReceipt(db, reportId, includeEvidence = false) {
  sealReport(db, reportId)
  const saved = db.prepare('SELECT evidence_hash, receipt_created_at FROM reports WHERE id = ?').get(reportId)
  const evidence = snapshot(db, reportId)
  if (!saved || !evidence) return null
  const current = hash(canonical(evidence))
  return { version: evidence.version, reportId, fingerprint: saved.evidence_hash, createdAt: saved.receipt_created_at, matches: current === saved.evidence_hash,
    answerCount: evidence.answers.length, sourceFingerprint: evidence.sourceFingerprint,
    note: 'This receipt checks consistency of saved source, responses and AI findings. It does not verify the speaker’s identity, authorship or understanding. Teacher review and feedback are held separately.',
    ...(includeEvidence ? { evidence } : {}) }
}

export function verifyReceiptData(receipt) {
  if (!receipt?.evidence || receipt.version !== 'merit-lens-evidence-v1') return { matches: false, reason: 'Unsupported or incomplete evidence receipt.' }
  const sourceMatches = typeof receipt.evidence.sourceText === 'string' && hash(receipt.evidence.sourceText) === receipt.evidence.sourceFingerprint
  const recordMatches = hash(canonical(receipt.evidence)) === receipt.fingerprint
  return { matches: sourceMatches && recordMatches, sourceMatches, recordMatches }
}
