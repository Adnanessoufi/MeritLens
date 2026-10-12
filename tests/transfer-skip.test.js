import { test } from 'node:test'
import assert from 'node:assert/strict'
import { setup } from './helpers.js'
import { createAI } from '../server/ai.js'
import { getConfig } from '../server/config.js'
import { normalizePairAssessment } from '../server/transfer.js'

const pairs = [
  { concept:'Y-axis crossing', sourceQuote:'I calculate f(0).', originalQuestion:'How do you find where a graph crosses the y-axis?', expectedOriginal:'Set x to zero and calculate y = f(0).',
    changedScenario:'The graph moves up by three.', transferQuestion:'What happens to its y-axis crossing?', expectedTransfer:'The crossing moves up by three.', invariant:'The y-axis has x = 0.', acceptableAlternatives:[], changeType:'scenario' },
  { concept:'Slope', sourceQuote:'I divide the change in y by the change in x.', originalQuestion:'How do you find the slope between two points?', expectedOriginal:'Divide the change in y by the change in x.',
    changedScenario:'The two points have the same x-value.', transferQuestion:'What happens to the slope?', expectedTransfer:'The line is vertical and the slope is undefined.', invariant:'Slope is change in y divided by change in x.', acceptableAlternatives:[], changeType:'constraint' }
]
async function challenge(t, { failOnce = false } = {}) {
  const calls = [], adaptations = [], cached = []
  const base = createAI(getConfig({ DEMO_MODE:'true' }))
  const semantic = createAI(getConfig({ DEMO_MODE:'false', OPENAI_API_KEY:'fixture' }), async (url, options) => {
    const body = JSON.parse(options.body), input = JSON.parse(body.input)
    calls.push({ name:body.text.format.name, input })
    if (failOnce) { failOnce = false; throw new Error('Evaluator temporarily unavailable') }
    const original = input.originalResponse
    const wrong = /set y to zero/i.test(original), partial = original === 'It measures how steep the line is.'
    return new Response(JSON.stringify({ output:[{ content:[{ type:'output_text', text:JSON.stringify({
      explanationScore:wrong?0:partial?1:2, originalQuote:original,
      explanationRationale:wrong?'The answer reverses the axes.':partial?'It describes slope but does not give the calculation.':'The answer gives the correct rule.',
      feedback:wrong?'For the y-axis, set x to zero, then calculate y. That is okay.':''
    }) }] }] }))
  })
  const ai = { ...base, assessTransferOriginal:semantic.assessTransferOriginal,
    generateTransferPairs:async()=>pairs,
    adaptInterviewQuestion:async(analysis,q)=>{adaptations.push(q.pairId);return q},
    assessTransferPair:async(spec,original,application,mode,language,saved)=>{
      cached.push(saved)
      return normalizePairAssessment({ ...saved, transferScore:2, consistencyScore:saved.explanationScore,
        transferQuote:application, transferRationale:'Applies the principle correctly.', consistencyRationale:'The same principle is used.', nextStep:'', feedback:'Thanks for explaining.' }, original, application, spec)
    }
  }
  const app = await setup(t, { demo:false, openaiKey:'fixture' }, { ai })
  await app.request('/assignments/sample-python',{method:'PATCH',body:{challengeMode:'transfer',pairCount:2}})
  return { ...app, calls, adaptations, cached }
}

test('unknown and silent first answers skip application, preserve real evidence and finish without false gaps', async t => {
  const app = await challenge(t)
  let session = (await app.submit()).data
  const firstId = session.question.id
  session = (await app.answer(session,"I don't know")).data
  assert.equal(session.question.stage,'explain');assert.equal(session.question.pairIndex,2)
  assert.equal(session.answered,1);assert.equal(session.maxQuestions,3)
  assert.match(session.lastAnswerFeedback,/next question/i)
  const refreshed = (await app.request('/sessions/'+session.id)).data
  assert.equal(refreshed.question.id,session.question.id)
  const duplicate = await app.request('/sessions/'+session.id+'/answers',{method:'POST',body:{questionId:firstId,transcript:"I don't know"}})
  assert.equal(duplicate.data.answered,1);assert.equal(duplicate.data.question.id,session.question.id)
  session = (await app.answer(refreshed,'',{skip:true})).data
  assert.equal(session.status,'completed');assert.equal(session.maxQuestions,2)
  assert.equal(app.calls.length,0);assert.equal(app.adaptations.length,0);assert.equal(app.cached.length,0)
  const report = (await app.request('/reports/'+session.reportId)).data
  assert.equal(report.answers.length,2)
  assert.ok(report.answers.every(a=>a.rubric.score===0&&a.rubric.applicationSkipped&&a.rubric.stage==='explain'))
  assert.equal(report.transferSummary.skippedPairs,2)
  assert.equal(report.transferSummary.status,'WEAK');assert.equal(report.transferSummary.gapCount,0)
  assert.equal(report.transferSummary.explanation.earned,0);assert.equal(report.transferSummary.explanation.possible,4)
  assert.equal(report.transferSummary.transfer.possible,0)
  assert.ok(report.transferSummary.pairs.every(p=>p.assessmentState==='skipped'&&p.applicationPosition===null&&p.transferScore===null))
  assert.equal(report.evidenceReceipt.matches,true)
  const pdf = await fetch(app.base+'/api/reports/'+session.reportId+'/download')
  assert.equal(pdf.status,200);assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0,4).toString(),'%PDF')
})

test('wrong explanation skips only its application; the next valid concept still gets application and cached grading',async t=>{
  const app = await challenge(t)
  let session = (await app.submit()).data
  session = (await app.answer(session,'I set y to zero and solve for x.')).data
  assert.equal(session.question.stage,'explain');assert.equal(session.question.concept,'Slope')
  assert.match(session.lastAnswerFeedback,/set x to zero/)
  assert.equal(app.adaptations.length,0)
  assert.equal(app.calls[0].name,'transfer_original_evidence')
  const input = JSON.stringify(app.calls[0].input)
  assert.ok(!input.includes(pairs[0].changedScenario)&&!input.includes(pairs[0].expectedTransfer),'unseen case and answers cannot affect the original grade')
  session = (await app.answer(session,'Divide the change in y by the change in x.')).data
  assert.equal(session.question.stage,'apply');assert.equal(session.question.pairIndex,2)
  assert.equal(session.lastAnswerFeedback,'')
  session = (await app.answer(session,'The line is vertical and the slope is undefined.')).data
  assert.equal(session.status,'completed');assert.equal(session.answered,3)
  assert.equal(app.calls.length,2);assert.equal(app.cached.length,1)
  assert.equal(app.cached[0].explanationScore,2)
  const report = (await app.request('/reports/'+session.reportId)).data
  assert.deepEqual(report.answers.map(a=>a.rubric.score),[0,2,2])
  assert.equal(report.transferSummary.completedPairs,1);assert.equal(report.transferSummary.skippedPairs,1)
  assert.equal(report.transferSummary.status,'WEAK');assert.equal(report.transferSummary.gapCount,0)
  assert.equal(report.transferSummary.explanation.earned,2);assert.equal(report.transferSummary.explanation.possible,4)
  assert.equal(report.transferSummary.transfer.earned,2);assert.equal(report.transferSummary.transfer.possible,2)
  assert.equal(report.evidenceReceipt.matches,true)
})

test('partly correct reasoning still gets application without a correction hint',async t=>{
  const app = await challenge(t)
  let session = (await app.submit()).data
  session = (await app.answer(session,"I don't know")).data
  session = (await app.answer(session,'It measures how steep the line is.')).data
  assert.equal(session.question.stage,'apply');assert.equal(session.question.pairIndex,2)
  assert.equal(session.lastAnswerFeedback,'');assert.equal(app.adaptations.length,1)
  const answer = app.db.prepare('SELECT rubric FROM answers WHERE session_id=? AND position=2').get(session.id)
  assert.equal(JSON.parse(answer.rubric).score,1)
})

test('original evaluation failure leaves the same question and response timing available for one successful retry',async t=>{
  const app = await challenge(t,{failOnce:true})
  let session = (await app.submit()).data
  const originalId = session.question.id
  const failed = await app.answer(session,'I set y to zero and solve for x.')
  assert.ok(failed.status>=500)
  const held = (await app.request('/sessions/'+session.id)).data
  assert.equal(held.question.id,originalId);assert.equal(held.answered,0);assert.ok(held.responseEndedAt)
  const savedTime = held.responseEndedAt
  session = (await app.answer(held,'I set y to zero and solve for x.')).data
  assert.equal(session.answered,1);assert.equal(session.question.pairIndex,2)
  const rows = app.db.prepare('SELECT response_ended_at FROM answers WHERE session_id=?').all(session.id)
  assert.equal(rows.length,1);assert.equal(rows[0].response_ended_at,savedTime)
})
