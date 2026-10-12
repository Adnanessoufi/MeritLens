import { getConfig } from '../server/config.js'
import { showcaseCases } from '../server/demo.js'
const config = getConfig()
if (config.demo || !config.openaiKey) throw new Error('This example needs live assessment with this project’s configured OpenAI key.')
const base = 'http://127.0.0.1:' + (process.env.PORT || 5173)
async function request(path, body) {
  const response = await fetch(base + '/api' + path, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const result = await response.json()
  if (!response.ok) throw new Error(path + ': ' + (result.error || response.status))
  return result
}
const showcase = await request('/showcase')
const original = showcase.cases.find(c => c.kind === 'follow-up')
if (!original?.reportId) throw new Error('Prepare the three showcase cases first.')
let session = await request('/reports/' + original.reportId + '/follow-up', { concepts: ['Cooling mechanism'] })
const clear = showcaseCases.find(c => c.kind === 'reasoning').answers['Cooling mechanism']
while (session.status === 'active') {
  const transcript = session.answered === 0
    ? 'I have revisited my first explanation. Shade blocks sunlight from heating the surface. Evaporation from leaves uses energy and can cool nearby air. These are different mechanisms; just listing the terms does not explain them.'
    : /humid/i.test(session.question.text)
      ? 'High humidity reduces the difference in water-vapour concentration between a leaf and the air, so evaporation can be less effective. I would still expect shading to reduce sunlight reaching the pavement, but I would measure the two effects separately.'
      : clear[Math.min(session.answered, 1)]
  await request('/sessions/' + session.id + '/present', { questionId: session.question.id })
  session = await request('/sessions/' + session.id + '/answers', { questionId: session.question.id, transcript, method: 'text' })
  console.log(session.answered + ' focused responses saved')
}
if (session.status === 'reporting') session = await request('/sessions/' + session.id + '/report', {})
if (session.status !== 'completed') throw new Error('The focused follow-up report did not complete.')
console.log('Fictional follow-up comparison is ready: ' + base + '/#/teacher/report/' + session.reportId)
