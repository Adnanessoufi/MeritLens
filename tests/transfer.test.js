import { test } from 'node:test'
import assert from 'node:assert/strict'
import { supportedTransferOriginal, setup, sample } from './helpers.js'
import { createAI } from '../server/ai.js'
import { getConfig } from '../server/config.js'
import { transferBank, normalizePairAssessment, selectTransferConcepts } from '../server/transfer.js'
import { benchmarkPairs } from '../shared/transfer-fixtures.js'

const scored = (spec, original, application) => normalizePairAssessment({ explanationScore: 2, transferScore: 0, consistencyScore: 2,
  originalQuote: original, transferQuote: application, explanationRationale: 'Sound original reasoning.', transferRationale: 'Ignores the changed constraint.', consistencyRationale: 'The original principle is not applied under the change.', nextStep: 'Explain how the new constraint changes the decision.' }, original, application, spec)
async function transferSetup(t, { count = 3, fail = false } = {}) {
  const base = createAI(getConfig({ DEMO_MODE: 'true' }))
  let pairCalls = 0
  let failOnce = fail
  const ai = { ...base, assessTransferOriginal:supportedTransferOriginal, generateTransferPairs: async () => benchmarkPairs.slice(0, count), assessTransferPair: async (spec, original, application) => {
    pairCalls++; if (failOnce) { failOnce = false; throw Object.assign(new Error('Paired evaluator unavailable'), { status: 502 }) }
    return original && application ? scored(spec, original, application) : normalizePairAssessment({}, original, application, spec)
  } }
  const app = await setup(t, { demo: false, openaiKey: 'test-only' }, { ai })
  await app.request('/assignments/sample-python',{method:'PATCH',body:{challengeMode:'transfer',pairCount:count}})
  return { ...app, pairCalls: () => pairCalls }
}

test('transfer mode asks complete ordered pairs and records joint scores and gaps', async t => {
  const app = await transferSetup(t)
  let session = (await app.submit({ challengeMode: 'transfer', pairCount: 3 })).data
  assert.equal(session.challengeMode, 'transfer'); assert.equal(session.maxQuestions, 6)
  assert.equal(session.question.stage, 'explain')
  assert.ok(!('pairSpec' in session.question), 'private expected answers never reach the student')
  for (let i = 0; i < 6; i++) {
    assert.equal(session.question.stage, i % 2 ? 'apply' : 'explain')
    assert.equal(session.question.pairIndex, Math.floor(i / 2) + 1)
    const id = session.question.id
    session = (await app.answer(session, i % 2 ? 'I repeat my original decision despite the new constraint.' : 'I explain my original design correctly.')).data
    const repeated = await app.request('/sessions/' + session.id + '/answers', { method: 'POST', body: { questionId: id, transcript: 'Duplicate' } })
    assert.equal(repeated.data.answered, i + 1)
  }
  assert.equal(session.status, 'completed'); assert.equal(app.pairCalls(), 3)
  const report = (await app.request('/reports/' + session.reportId)).data
  assert.equal(report.transferSummary.pairs.length, 3)
  assert.equal(report.transferSummary.gapCount, 3)
  assert.equal(report.transferSummary.transfer.earned, 0)
  assert.equal(report.transferSummary.consistency.earned, 0, 'repeated wording cannot earn semantic consistency')
  assert.ok(report.transferSummary.pairs.every(p => p.originalPosition && p.applicationPosition))
  assert.equal(report.evidenceReceipt.matches, true)
  const exportData = (await app.request('/reports/' + session.reportId + '/receipt')).data
  assert.equal(exportData.evidence.transferChallenge.gapCount, 3)
})

test('two-concept challenge finishes only after four responses; missing application is incomplete, not a gap', async t => {
  const app = await transferSetup(t, { count: 2 })
  let session = (await app.submit({ challengeMode: 'transfer', pairCount: 2 })).data
  assert.equal(session.maxQuestions, 4)
  for (let i = 0; i < 4; i++) session = (await app.answer(session, i % 2 ? '' : 'A sound original explanation.', i % 2 ? { skip: true, method: 'skipped' } : {})).data
  const report = (await app.request('/reports/' + session.reportId)).data
  assert.equal(report.transferSummary.status, 'INCOMPLETE')
  assert.equal(report.transferSummary.gapCount, 0)
  assert.equal(report.transferSummary.consistency.percent, null)
})

test('pair assessment failure preserves explanation and application timing for retry', async t => {
  const app = await transferSetup(t, { count: 2, fail: true })
  let session = (await app.submit({ challengeMode: 'transfer', pairCount: 2 })).data
  session = (await app.answer(session, 'My first explanation is saved.')).data
  const current = session.question.id
  assert.equal((await app.answer(session, 'My application answer.')).status, 502)
  session = (await app.request('/sessions/' + session.id)).data
  assert.equal(session.question.id, current); assert.equal(session.answered, 1); assert.ok(session.responseEndedAt)
  const retry = await app.answer(session, 'My application answer.')
  assert.equal(retry.status, 200); assert.equal(retry.data.answered, 2)
})

test('consistency rewards changed justified decisions and abstains on unsupported original reasoning', () => {
  const spec = benchmarkPairs[0]
  const baseline = { explanationScore: 2, transferScore: 2, consistencyScore: 2, originalQuote: 'original', transferQuote: 'changed', explanationRationale: '', transferRationale: '', consistencyRationale: '', nextStep: '' }
  assert.equal(normalizePairAssessment(baseline, 'original', 'changed', spec).status, 'STRONG')
  const wrong = normalizePairAssessment({ ...baseline, explanationScore: 0, transferScore: 0 }, 'original', 'changed', spec)
  assert.match(wrong.consistencyRationale, /not rated/); assert.equal(wrong.consistencyScore, null); assert.equal(wrong.gapFlag, false); assert.equal(wrong.status, 'WEAK')
  const highTransfer = normalizePairAssessment({ ...baseline, explanationScore: 0 }, 'original', 'changed', spec)
  const failedApply = scored(spec, 'original', 'changed'); assert.equal(failedApply.consistencyScore, 0); assert.match(failedApply.consistencyRationale, /Consistency is 0/);
  assert.equal(highTransfer.status, 'PARTIAL'); assert.equal(highTransfer.consistencyScore, null)
})

test('transfer concepts must be grounded and cannot fall back to a one-concept generic challenge', () => {
  assert.throws(() => selectTransferConcepts({ concepts: [{ name: 'Only one', evidence: sample }] }, [], 3), /At least two/)
  assert.throws(() => selectTransferConcepts({ concepts: [] }, [], 1), /two or three/)
  assert.equal(transferBank(benchmarkPairs.slice(0, 2)).length, 4)
})

test('question generation reviews and repairs an incoherent changed scenario before delivery', async () => {
  const calls = []
  const fields = Object.fromEntries(benchmarkPairs.map((p, i) => ['pair_' + i, { ...p }]))
  const invalid = structuredClone(fields)
  invalid.pair_0.changedScenario = 'The catalog must store multiple editions under the same ISBN with edition numbers.'
  const review = Object.fromEntries(benchmarkPairs.map((p, i) => ['pair_' + i, { decision: 'accepted', reason: 'Test deliberately leaves a factual error for the native gate.' }]))
  const outputs = [invalid, { review, pairs: invalid }, fields]
  const ai = createAI(getConfig({ OPENAI_API_KEY: 'test-only', DEMO_MODE: 'false' }), async (url, init) => {
    calls.push(JSON.parse(init.body).text.format.name)
    return new Response(JSON.stringify({ output: [{ content: [{ type: 'output_text', text: JSON.stringify(outputs.shift()) }] }] }))
  })
  const analysis = { concepts: benchmarkPairs.map(p => ({ name: p.concept, evidence: p.sourceQuote })), summary: 'Catalog', sections: [], questions: [] }
  const pairs = await ai.generateTransferPairs(analysis, { title: 'Catalog', brief: 'Defend it', concepts: benchmarkPairs.map(p => p.concept) }, sample, 3)
  assert.deepEqual(calls, ['transfer_question_pairs', 'transfer_pair_review', 'transfer_domain_repair'])
  assert.equal(pairs.length, 3)
  assert.match(pairs[0].changedScenario, /physical copies/)
  assert.equal(pairs[0].generationReview.decision, 'revised')
})

test('original explanation is assessed without exposure to the unseen transfer scenario', async () => {
  const spec = benchmarkPairs[2]
  const original = 'get returns None for missing ISBNs; duplicate rejection keeps the original entry.'
  const application = 'An empty dictionary cannot be falsey, so there is no bug.'
  const originalAssessment = { explanationScore: 2, originalQuote: original, explanationRationale: 'The answer satisfies the original testing question.', feedback: '' }
  const calls = []
  const ai = createAI(getConfig({ OPENAI_API_KEY: 'test-only', DEMO_MODE: 'false' }), async (url, init) => {
    const body = JSON.parse(init.body); calls.push(body)
    const output = calls.length === 1 ? originalAssessment : { ...originalAssessment, transferScore: 0, consistencyScore: 0,
      transferQuote: application, transferRationale: 'The empty record is falsey; the proposed reasoning ignores the bug.',
      consistencyRationale: 'The principle is not applied under the change.', nextStep: 'Distinguish absence from an empty record.',feedback:'An empty record can be falsey. That is okay; let us move on.' }
    return new Response(JSON.stringify({ output: [{ content: [{ type: 'output_text', text: JSON.stringify(output) }] }] }))
  })
  const result = await ai.assessTransferPair(spec, original, application)
  assert.equal(calls.length, 2)
  assert.equal(calls[0].text.format.name, 'transfer_original_evidence')
  const originalInput = JSON.parse(calls[0].input)
  assert.deepEqual(Object.keys(originalInput).sort(), ['concept', 'sourceQuote', 'originalQuestion', 'expectedOriginal', 'originalResponse', 'originalQuoteCandidates', 'responseLanguage'].sort())
  assert.equal(originalInput.responseLanguage,'English')
  assert.ok(!calls[0].input.includes(spec.changedScenario))
  assert.ok(!calls[0].input.includes(spec.expectedTransfer))
  assert.ok(!calls[0].input.includes(application))
  assert.deepEqual(calls[1].text.format.schema.properties.explanationScore.enum, [2])
  assert.equal(result.explanationScore, 2)
  assert.equal(result.gapSeverity, 'clear')
})

test('adaptive guides vary across explain, apply and bug questions; extensions stay with the current question', async t => {
  const app = await transferSetup(t)
  let session = (await app.submit({ challengeMode: 'transfer', pairCount: 3 })).data
  assert.equal(session.timingMode, 'adaptive')
  assert.equal(session.duration, 30)
  await app.request('/sessions/' + session.id + '/present', { method: 'POST', body: { questionId: session.question.id } })
  const before = (await app.request('/sessions/' + session.id)).data
  for (let i = 0; i < 2; i++) session = (await app.request('/sessions/' + session.id + '/more-time', { method: 'POST', body: { questionId: session.question.id } })).data
  assert.equal(session.duration, 60)
  assert.equal(session.questionStartedAt, before.questionStartedAt)
  assert.equal((await app.request('/sessions/' + session.id)).data.duration, 60, 'reload preserves the extended current guide')
  session = (await app.answer(session, 'A supported explanation.')).data
  assert.equal(session.duration, 45, 'application receives its own guide instead of inheriting the extension')
  const originalAnswer = app.db.prepare('SELECT rubric FROM answers WHERE session_id = ? AND position = 1').get(session.id)
  assert.equal(JSON.parse(originalAnswer.rubric).timeGuideSeconds, 60)
  for (let i = 1; i < 6; i++) {
    assert.equal(session.duration, [30, 45, 30, 45, 30, 60][i])
    session = (await app.answer(session, 'An application or explanation.')).data
  }
  assert.equal(session.status, 'completed')
  assert.equal((await app.request('/reports/' + session.reportId)).data.evidenceReceipt.matches, true)
})

test('teacher owns challenge mode and concept count; student overrides are rejected and existing sessions keep their policy',async t=>{
 const base=createAI(getConfig({DEMO_MODE:'true'})),ai={...base,assessTransferOriginal:supportedTransferOriginal,generateTransferPairs:async(a,b,c,count)=>benchmarkPairs.slice(0,count),assessTransferPair:async(spec,original,application)=>scored(spec,original,application)}
 const app=await setup(t,{demo:false,openaiKey:'test-only'},{ai})
 await app.request('/assignments/sample-python',{method:'PATCH',body:{challengeMode:'transfer',pairCount:2}})
 assert.equal((await app.submit({challengeMode:'standard'})).status,409)
 assert.equal((await app.submit({pairCount:3})).status,409)
 const accepted=await app.submit();assert.equal(accepted.status,201);assert.equal(accepted.data.challengeMode,'transfer');assert.equal(accepted.data.maxQuestions,4)
 await app.request('/assignments/sample-python',{method:'PATCH',body:{challengeMode:'standard',pairCount:3}})
 const next=await app.submit();assert.equal(next.data.challengeMode,'standard')
 const original=await app.request('/sessions/'+accepted.data.id);assert.equal(original.data.challengeMode,'transfer');assert.equal(original.data.maxQuestions,4)
 const invalid=await app.request('/assignments/sample-python',{method:'PATCH',body:{challengeMode:'transfer',pairCount:4}});assert.equal(invalid.status,400)
})
