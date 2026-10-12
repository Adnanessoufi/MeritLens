import { openDatabase, id, now, transaction } from '../server/db.js'
import { getConfig } from '../server/config.js'
import { demoWork, showcaseCases } from '../server/demo.js'

const config = getConfig()
if (config.demo || !config.openaiKey) throw new Error('Preparing live showcase evidence requires a working OpenAI key and live assessment.')
const base = 'http://127.0.0.1:' + (process.env.PORT || 5173)
const db = openDatabase(config.database)
const assignmentId = 'showcase-cooling'
const refreshKind = process.argv.find(arg => arg.startsWith('--refresh='))?.split('=')[1]
async function request(path, body) {
  const response = await fetch(base + '/api' + path, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const data = await response.json()
  if (!response.ok) throw new Error(path + ': ' + (data.error || response.status))
  return data
}
try {
  const serverConfig = await request('/config')
  if (serverConfig.mode !== 'live') throw new Error('Select live assessment before preparing the showcase.')
  transaction(db, () => {
    if (!db.prepare('SELECT id FROM assignments WHERE id = ?').get(assignmentId)) db.prepare('INSERT INTO assignments (id, title, subject, brief, concepts, created_at, response_seconds) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(assignmentId, demoWork.title, demoWork.subject, demoWork.brief, JSON.stringify(demoWork.concepts), now(), 90)
    for (const [concept, question] of demoWork.questions) if (!db.prepare('SELECT id FROM questions WHERE assignment_id = ? AND concept = ?').get(assignmentId, concept)) db.prepare('INSERT INTO questions VALUES (?, ?, ?, ?, ?, ?, ?)').run(id(), assignmentId, concept, question, 1, 'teacher', now())
  })
  for (const scenario of showcaseCases) {
    if (refreshKind === scenario.kind) db.prepare('UPDATE submissions SET archived = 1 WHERE showcase_kind = ? AND archived = 0').run(scenario.kind)
    const saved = db.prepare('SELECT s.id, s.status FROM sessions s JOIN submissions u ON u.id = s.submission_id WHERE u.showcase_kind = ? AND u.archived = 0 AND s.parent_session_id IS NULL ORDER BY u.created_at DESC').get(scenario.kind)
    if (saved?.status === 'completed') { console.log(scenario.kind + ': saved example already ready'); continue }
    let session = saved ? await request('/sessions/' + saved.id) : await request('/submissions', { assignmentId, student: scenario.student, requestId: 'showcase-' + scenario.kind + (refreshKind === scenario.kind ? '-refresh-' + Date.now() : '-v1'), text: demoWork.text, language: 'en' })
    db.prepare('UPDATE submissions SET showcase_kind = ? WHERE id = (SELECT submission_id FROM sessions WHERE id = ?)').run(scenario.kind, session.id)
    while (session.status === 'active') {
      const answered = db.prepare('SELECT COUNT(*) AS n FROM answers WHERE session_id = ? AND concept = ?').get(session.id, session.question.concept).n
      const concept = session.question.concept
      const key = Object.keys(scenario.answers).find(c => c === concept)
        || (/cool|shade|evapo|mechan/i.test(concept) ? 'Cooling mechanism' : /evidence|control|compar|measur|pilot|caus|temperature|observation|confound/i.test(concept) ? 'Evidence and controls' : 'Trade-offs')
      const transcript = scenario.answers[key][Math.min(answered, 1)]
      await request('/sessions/' + session.id + '/present', { questionId: session.question.id })
      session = await request('/sessions/' + session.id + '/answers', { questionId: session.question.id, transcript, method: 'text' })
      console.log(scenario.kind + ': ' + session.answered + ' responses saved')
    }
    if (session.status === 'reporting') session = await request('/sessions/' + session.id + '/report', {})
    if (session.status !== 'completed') throw new Error('The ' + scenario.kind + ' report is not complete.')
    console.log(scenario.kind + ': report ready ' + session.reportId)
  }
  console.log('All fictional showcase examples are ready. Open /#/showcase.')
} catch(e) { console.error(e.message); process.exitCode = 1 }
finally { db.close() }
