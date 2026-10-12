import { openDatabase, now } from '../server/db.js'
import { getConfig } from '../server/config.js'
import { createAI } from '../server/ai.js'
import { createApp } from '../server/app.js'
import { transferWork, benchmarkPairs, transferProfiles } from '../shared/transfer-fixtures.js'
import { normalizePairAssessment, TRANSFER_RUBRIC_VERSION } from '../server/transfer.js'
import { mkdirSync, writeFileSync } from 'node:fs'

const config = getConfig()
if (config.demo || !config.openaiKey) throw new Error('Use the configured live OpenAI mode to prepare measured transfer examples.')
const ai = createAI(config)
console.log('Analyzing the shared benchmark submission…')
const analysis = await ai.analyze(transferWork.text, transferWork, 'en')
console.log('Generating a fresh source-specific 3-concept transfer plan…')
const generated = await ai.generateTransferPairs(analysis, transferWork, transferWork.text, 3)
mkdirSync('.test-artifacts', { recursive: true })
writeFileSync('.test-artifacts/transfer-generated-plan.json', JSON.stringify({ source: transferWork, pairs: generated, at: new Date().toISOString() }, null, 2))
const db = openDatabase(config.database)
const assignmentId = 'transfer-python'
if (process.argv.includes('--refresh')) {
  for (const profile of transferProfiles) db.prepare('UPDATE submissions SET archived = 1 WHERE showcase_kind = ?').run('transfer-' + profile.kind)
}
if (!db.prepare('SELECT id FROM assignments WHERE id = ?').get(assignmentId)) db.prepare('INSERT INTO assignments (id, title, subject, brief, concepts, created_at, response_seconds) VALUES (?, ?, ?, ?, ?, ?, ?)')
  .run(assignmentId, transferWork.title, transferWork.subject, transferWork.brief, JSON.stringify(transferWork.concepts), now(), 90)
db.prepare("UPDATE assignments SET challenge_mode='transfer',concept_count=3 WHERE id=?").run(assignmentId)
// Fair comparison: every fictional response profile receives the identical auditable reference benchmark pairs.
// Fresh custom uploads use generateTransferPairs; the freshly generated plan above demonstrates that separate path.
const benchmarkAI = { ...ai, analyze: async () => analysis, generateTransferPairs: async () => benchmarkPairs }
const app = createApp(db, { ...config }, { ai: benchmarkAI })
const server = app.listen(0, '127.0.0.1')
await new Promise(resolve => server.once('listening', resolve))
const base = 'http://127.0.0.1:' + server.address().port
async function request(path, body) {
  const response = await fetch(base + '/api' + path, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const data = await response.json(); if (!response.ok) throw new Error(path + ': ' + (data.error || response.status)); return data
}
const validation = { at: new Date().toISOString(), model: config.model, rubricVersion: TRANSFER_RUBRIC_VERSION, syntheticOnly: true,
  setup: 'Identical source and frozen auditable reference question pairs; expected labels are held out of grading requests.', total: 0, agreement: 0, gapExpected: 3, gapTruePositives: 0, falseGapFlags: 0, cases: [] }
function record(name, expected, result, expectedGap = false) {
  const matched = result.status === expected
  validation.total++; if (matched) validation.agreement++
  if (expectedGap && result.gapFlag) validation.gapTruePositives++
  if (!expectedGap && result.gapFlag) validation.falseGapFlags++
  validation.cases.push({ name, expected, observed: result.status, matched, expectedGap, gapFlag: result.gapFlag, gapSeverity: result.gapSeverity,
    explanationScore: result.explanationScore, transferScore: result.transferScore, consistencyScore: result.consistencyScore,
    originalQuote: result.originalQuote, transferQuote: result.transferQuote, explanationRationale: result.explanationRationale,
    transferRationale: result.transferRationale, consistencyRationale: result.consistencyRationale })
  console.log(name + ': ' + result.status + ' · E ' + result.explanationScore + ' / T ' + result.transferScore + ' / C ' + result.consistencyScore + (matched ? ' · expected match' : ' · REVIEW DISAGREEMENT'))
}
try {
  for (const profile of transferProfiles) {
    const existing = db.prepare("SELECT s.id FROM sessions s JOIN submissions u ON u.id = s.submission_id WHERE u.showcase_kind = ? AND u.archived = 0 AND s.parent_session_id IS NULL ORDER BY u.created_at DESC").get('transfer-' + profile.kind)
    let session = existing ? await request('/sessions/' + existing.id) : await request('/submissions', { requestId: 'transfer-benchmark-' + profile.kind + (process.argv.includes('--refresh') ? '-refresh-' + Date.now() : '-v1'), assignmentId, student: profile.name, text: transferWork.text, challengeMode: 'transfer', pairCount: 3 })
    db.prepare('UPDATE submissions SET showcase_kind = ? WHERE id = (SELECT submission_id FROM sessions WHERE id = ?)').run('transfer-' + profile.kind, session.id)
    while (session.status === 'active') {
      const index = session.question.pairIndex - 1
      const transcript = session.question.stage === 'explain' ? profile.originals[index] : profile.applications[index]
      await request('/sessions/' + session.id + '/present', { questionId: session.question.id })
      session = await request('/sessions/' + session.id + '/answers', { questionId: session.question.id, transcript, method: 'text' })
      console.log(profile.kind + ': ' + session.answered + ' / 6 responses saved')
    }
    if (session.status === 'reporting') session = await request('/sessions/' + session.id + '/report', {})
    const report = await request('/reports/' + session.reportId)
    for (const pair of report.transferSummary.pairs) record(profile.kind + ' · ' + pair.concept, profile.expected, pair, profile.kind === 'weak')
  }
  const strong = transferProfiles[0]
  record('Valid alternative · composite copy key', 'STRONG', await ai.assessTransferPair(benchmarkPairs[0], strong.originals[0], 'I would use a composite (ISBN, copy ID) key. The shared ISBN links edition metadata, while the copy ID distinguishes the physical copies. Each composite key has its own loan status, so changing one copy cannot replace the other.' ))
  record('Repeated incorrect rule · not meaningful consistency', 'WEAK', await ai.assessTransferPair(benchmarkPairs[1], 'A list hashes every ISBN in constant time and a dictionary scans every item, so dictionary lookup is O(n).', 'The author query is automatically constant because every data structure hashes all fields. I do not need an author index or a scan.' ))
  record('Missing application · abstain', 'INCOMPLETE', normalizePairAssessment({}, strong.originals[0], '', benchmarkPairs[0]))
  record('Can apply but cannot explain baseline', 'PARTIAL', await ai.assessTransferPair(benchmarkPairs[0], 'I do not know why I chose it.', strong.applications[0]))
  validation.agreementPercent = Math.round(validation.agreement / validation.total * 100)
  db.prepare("INSERT INTO settings (key, value) VALUES ('transfer_validation', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(JSON.stringify(validation))
  db.prepare("INSERT INTO settings (key, value) VALUES ('transfer_generated_plan', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(JSON.stringify(generated))
  writeFileSync('.test-artifacts/transfer-validation.json', JSON.stringify(validation, null, 2))
  console.log('Measured agreement: ' + validation.agreement + '/' + validation.total + '. Gap flags: ' + validation.gapTruePositives + '/' + validation.gapExpected + ', false flags: ' + validation.falseGapFlags)
} finally { await new Promise(resolve => server.close(resolve)); db.close() }
