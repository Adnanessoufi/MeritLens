import {test} from 'node:test'
import assert from 'node:assert/strict'
import {supportedTransferOriginal,setup,sample} from './helpers.js'
import {createAI} from '../server/ai.js'
import {getConfig} from '../server/config.js'
import {responseKind,conversationLead} from '../shared/conversation.js'
import {benchmarkPairs} from '../shared/transfer-fixtures.js'
import {publicQuestion} from '../server/transfer.js'

test('intro is short and silent/filler replies never receive understanding acknowledgements',()=>{
 assert.ok(conversationLead({count:0}).split(/\s+/).length<=16)
 for(const transcript of['','...','[BLANK_AUDIO]','(silence)','Thank you for watching.','hmm']){
  assert.equal(responseKind(transcript),'none')
  const lead=conversationLead({count:1,previous:transcript,stage:'apply'})
  assert.match(lead,/didn't catch an answer/)
  assert.doesNotMatch(lead,/got it|understand|thanks/i)
 }
 assert.equal(responseKind('I do not know the answer to that question.'),'unknown')
 assert.equal(responseKind('I am not sure, but ISBN identifies the edition.'),'answer')
 assert.equal(responseKind('∞'),'answer');assert.equal(responseKind('∅'),'answer');assert.equal(responseKind('='),'answer')
})
test('silent marker remains a raw record, bypasses evaluation, and moves to source-specific work',async t=>{
 const base=createAI(getConfig({DEMO_MODE:'true'}));let evaluations=0
 const app=await setup(t,{}, {ai:{...base,evaluate:async()=>{evaluations++;throw Error('Silence must not be evaluated')}}})
 let session=(await app.submit()).data
 session=(await app.answer(session,'[BLANK_AUDIO]')).data
 assert.equal(evaluations,0)
 assert.match(session.conversationLead,/didn't catch/)
 const saved=app.db.prepare('SELECT transcript,status,rubric FROM answers WHERE session_id=?').get(session.id)
 assert.equal(saved.transcript,'[BLANK_AUDIO]');assert.equal(saved.status,'UNCLEAR')
 assert.equal(JSON.parse(saved.rubric).responseKind,'none')
})
test('transfer questions depend on the original reply, retain case/rubric and survive refresh',async t=>{
 const base=createAI(getConfig({DEMO_MODE:'true'}))
 const calls=[]
 const ai={...base,assessTransferOriginal:supportedTransferOriginal,generateTransferPairs:async()=>benchmarkPairs.slice(0,2),adaptInterviewQuestion:async(analysis,q,previous,transcript,history)=>{
  calls.push({concept:q.concept,transcript,previous:previous.text,history:history.length})
  const quote=transcript.includes('edition')?'ISBN identifies an edition':'Each catalog entry has a unique ISBN'
  const task=transcript.includes('edition')?'What needs its own status now?':'How do the two physical copies fit that claim?'
  return {...q,text:q.pairSpec.changedScenario+'\n\n'+'You said "'+quote+'". '+task,
   pairSpec:{...q.pairSpec,transferQuestion:'You said "'+quote+'". '+task},
   adaptation:{basedOnQuestionId:previous.id,answerQuote:quote,sourceQuote:q.pairSpec.sourceQuote,strategy:'apply'}}
 }}
 const app=await setup(t,{demo:false,openaiKey:'test-only'},{ai})
 await app.request('/assignments/sample-python',{method:'PATCH',body:{challengeMode:'transfer',pairCount:2}})
 const originals=['ISBN identifies an edition, not each physical copy.','Each catalog entry has a unique ISBN, so no key can collide.'],texts=[]
 for(const reply of originals){
  let session=(await app.submit()).data;session=(await app.answer(session,reply)).data
  texts.push(session.question.text);assert.equal(session.question.stage,'apply');assert.equal(session.answered,1)
  assert.ok(session.question.text.startsWith(benchmarkPairs[0].changedScenario))
  assert.equal(session.question.pairSpec,undefined);assert.equal(session.question.adaptation,undefined)
  const row=app.db.prepare('SELECT bank FROM sessions WHERE id=?').get(session.id),bank=JSON.parse(row.bank)
  assert.equal(bank[0].pairSpec.expectedTransfer,benchmarkPairs[0].expectedTransfer)
  assert.equal(bank[1].adaptation.answerQuote,reply.includes('edition')?'ISBN identifies an edition':'Each catalog entry has a unique ISBN')
  assert.equal((await app.request('/sessions/'+session.id)).data.question.text,session.question.text)
 }
 assert.notEqual(texts[0],texts[1]);assert.equal(calls.length,2)
 assert.deepEqual(calls.map(c=>c.transcript),originals)
})
test('live adapter rejects a generic next question without a literal response anchor',async()=>{
 const spec=benchmarkPairs[0],q={id:'apply',stage:'apply',concept:spec.concept,pairSpec:spec,text:spec.changedScenario+' '+spec.transferQuestion}
 const request=async(url,options)=>{const input=JSON.parse(JSON.parse(options.body).input);return new Response(JSON.stringify({output:[{content:[{type:'output_text',text:JSON.stringify({reaction:'',question:'What was most difficult in your assignment?',answerQuote:input.answerQuotes[0],sourceQuote:spec.sourceQuote,strategy:'apply'})}]}]}))}
 const ai=createAI(getConfig({OPENAI_API_KEY:'fake-test',DEMO_MODE:'false'}),request)
 await assert.rejects(ai.adaptInterviewQuestion({concepts:[]},q,{id:'original',text:spec.originalQuestion},'ISBN identifies an edition.'),/linked reliably/)
 assert.equal(publicQuestion({...q,adaptation:{answerQuote:'private'}}).adaptation,undefined)
})
test('failed adaptation keeps the original answer draft and one successful retry stores it once',async t=>{
 const base=createAI(getConfig({DEMO_MODE:'true'}));let fail=true
 const app=await setup(t,{demo:false,openaiKey:'fake-test'},{ai:{...base,assessTransferOriginal:supportedTransferOriginal,generateTransferPairs:async()=>benchmarkPairs.slice(0,2),adaptInterviewQuestion:async(...args)=>{if(fail){fail=false;throw Object.assign(Error('Adaptation temporarily unavailable'),{status:502})}return base.adaptInterviewQuestion(...args)}}})
 await app.request('/assignments/sample-python',{method:'PATCH',body:{challengeMode:'transfer',pairCount:2}})
 let session=(await app.submit()).data
 const qid=session.question.id
 await app.request('/sessions/'+session.id+'/meeting',{method:'POST',body:{cameraUnavailable:true,identityStatus:'not-checked',autoVoice:false}})
 const first=await app.answer(session,'ISBN identifies an edition.')
 assert.equal(first.status,502)
 const held=(await app.request('/sessions/'+session.id)).data
 assert.equal(held.answered,0);assert.equal(held.question.id,qid)
 assert.equal(held.meeting.draft.text,'ISBN identifies an edition.')
 const next=await app.answer(held,'ISBN identifies an edition.')
 assert.equal(next.status,200);assert.equal(next.data.answered,1)
})

test('numeric responses can drive a grounded question without matching part of another number',async()=>{
 const source='f(0) = -3',analysis={concepts:[{name:'Function evaluation',evidence:source}]},q={id:'next',concept:'Function evaluation',text:'What happens when the constant term changes?'}
 let question='You answered 0. How would the value change if the constant term changes?'
 const ai=createAI(getConfig({OPENAI_API_KEY:'fake-test',DEMO_MODE:'false'}),async()=>new Response(JSON.stringify({output:[{content:[{type:'output_text',text:JSON.stringify({reaction:'',question,answerQuote:'0',sourceQuote:source,strategy:'clarify'})}]}]})))
 const next=await ai.adaptInterviewQuestion(analysis,q,{id:'original',text:'What is f(0)?'},'0')
 assert.equal(next.adaptation.answerQuote,'0')
 question='What is the function at 20?'
 await assert.rejects(ai.adaptInterviewQuestion(analysis,q,{id:'original',text:'What is f(0)?'},'0'),/linked reliably/)
})
test('live interview cannot invent a generic question bank when no submission concepts are grounded',async t=>{
 const base=createAI(getConfig({DEMO_MODE:'true'}))
 const app=await setup(t,{demo:false,openaiKey:'fake-test'},{ai:{...base,analyze:async()=>({summary:'Unusable',concepts:[],questions:[],sections:[]})}})
 const result=await app.submit()
 assert.equal(result.status,422)
 assert.match(result.data.error,/No clear concepts/)
 assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM submissions').get().n,0)
})

test('a shorter literal quotation supports plain speech without rejecting an intact student answer',async()=>{
 const spec=benchmarkPairs[0],q={id:'apply',stage:'apply',concept:spec.concept,pairSpec:spec,text:spec.changedScenario+' '+spec.transferQuestion}
 const reply='ISBN identifies an edition, and I only store one catalog entry per edition.'
 const request=async(url,options)=>new Response(JSON.stringify({output:[{content:[{type:'output_text',text:JSON.stringify({reaction:'',question:'You said "only store one catalog". How would you keep both copies and update one without losing the other?',answerQuote:'and I only store one catalog',sourceQuote:spec.sourceQuote,strategy:'apply'})}]}]}))
 const ai=createAI(getConfig({OPENAI_API_KEY:'fixture',DEMO_MODE:'false'}),request)
 const next=await ai.adaptInterviewQuestion({concepts:[{name:spec.concept,evidence:spec.sourceQuote}]},q,{id:'before',text:spec.originalQuestion,concept:spec.concept},reply)
 assert.equal(next.adaptation.answerQuote,'only store one catalog')
 assert.equal(next.pairSpec.changedScenario,spec.changedScenario);assert.equal(next.pairSpec.expectedTransfer,spec.expectedTransfer)
})
