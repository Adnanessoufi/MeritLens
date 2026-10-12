import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {setup} from './helpers.js'
import {createAI} from '../server/ai.js'
import {getConfig} from '../server/config.js'
import {installDemoAssignments} from '../server/demo-assignments.js'
import {offTopicFeedback} from '../shared/off-topic.js'
const matlab=readFileSync(new URL('../server/demo-materials/practicing-answers.m',import.meta.url),'utf8')

test('unrelated answers get a spoken warning, repeat notice in inbox/report, zero question points and unchanged work grade',async t=>{
 let checks=0
 const base=createAI(getConfig({DEMO_MODE:'true'}))
 const ai={...base,assessSubmission:async(_text,a)=>({status:'suggested',score:20,total:20,criteria:a.rubric.map(r=>({...r,score:r.maxPoints,rationale:'Correct submitted code.',evidenceQuote:'',concern:''}))}),report:async()=>({summary:'Read the recorded answers.',strengths:[],reviewAreas:[],conceptEvidence:[]}),
  evaluate:async(_a,q,transcript)=>{const unrelated=/dog|sky/i.test(transcript);const wrong=/set y/i.test(transcript);return{status:unrelated||wrong?'UNCLEAR':'DEMONSTRATED',addressesQuestion:unrelated?'no':'yes',accuracy:wrong?'incorrect':unrelated?'not_established':'correct',reasoning:'not_required',application:'not_probed',explanation:unrelated?'The answer is unrelated to the question.':wrong?'For the y-axis, set x to zero.':'Correct answer.',feedback:wrong?'Set x to zero for the y-axis.':'Good job.',evidenceQuote:transcript}},
  classifyOffTopic:async(_q,text)=>{checks++;return{offTopic:true,aside:/dog/i.test(text)?'Your dog sounds great, man.':'Blue skies are nice, man.'}}}
 const app=await setup(t,{demo:false,openaiKey:'fixture'},{ai});installDemoAssignments(app.db)
 let session=(await app.submit({assignmentId:'sample-matlab',text:matlab})).data
 session=(await app.answer(session,'I like my dog. It is the best.')).data
 assert.match(session.lastAnswerFeedback,/dog.*take this seriously.*If it happens again/s);assert.equal(session.question.concept,'Point on a curve')
 session=(await app.answer(session,'The sky is blue.')).data
 assert.match(session.lastAnswerFeedback,/Blue skies.*flagged.*teacher/s);assert.equal(session.question.concept,'Y-axis crossing')
 const inbox=(await app.request('/submissions')).data.find(s=>s.session_id===session.id);assert.equal(inbox.off_topic_count,2)
 session=(await app.answer(session,'I set y to zero.')).data
 assert.doesNotMatch(session.lastAnswerFeedback,/flagged|seriously/);assert.equal(checks,2)
 session=(await app.answer(session,'The function equals zero at that x value.')).data
 session=(await app.answer(session,"I don't know")).data
 assert.equal(checks,2);assert.equal(session.status,'completed')
 const report=(await app.request('/reports/'+session.reportId)).data
 assert.deepEqual(report.offTopicSummary,{count:2,flagged:true,positions:[1,2]});assert.equal(report.gradingResult.score,20)
 assert.deepEqual(report.answers.map(a=>a.rubric.offTopic),[true,true,false,false,false]);assert.deepEqual(report.answers.slice(0,3).map(a=>a.rubric.score),[0,0,0]);assert.equal(report.answers[3].rubric.score,2);assert.equal(report.evidenceReceipt.matches,true)
 const duplicate=await app.request('/sessions/'+session.id+'/answers',{method:'POST',body:{questionId:report.answers[0].question_id,transcript:'dog'}});assert.equal(duplicate.data.answered,5)
})

test('off-topic original in challenge mode skips its application, while uncertainty does not trigger another warning',async t=>{
 const base=createAI(getConfig({DEMO_MODE:'true'})),app=await setup(t,{demo:false,openaiKey:'fixture'},{ai:{...base,assessSubmission:async()=>null,assessTransferOriginal:async(_s,text)=>({explanationScore:0,originalQuote:text,explanationRationale:'No answer to the current question.',feedback:'Try the next concept.'}),classifyOffTopic:async()=>({offTopic:true,aside:'Your dog sounds great, man.'})}})
 installDemoAssignments(app.db);await app.request('/assignments/sample-matlab',{method:'PATCH',body:{challengeMode:'transfer',pairCount:2}})
 let session=(await app.submit({assignmentId:'sample-matlab',text:matlab})).data
 session=(await app.answer(session,'I love my dog.')).data
 assert.equal(session.question.stage,'explain');assert.equal(session.question.concept,'Point on a curve');assert.match(session.lastAnswerFeedback,/If it happens again/)
 session=(await app.answer(session,"I don't know")).data
 const report=(await app.request('/reports/'+session.reportId)).data
 assert.equal(report.offTopicSummary.count,1);assert.equal(report.offTopicSummary.flagged,false);assert.equal(report.transferSummary.skippedPairs,2)
 assert.doesNotMatch(session.lastAnswerFeedback,/teacher|seriously/)
})

test('topic check sees actual question/source and excludes weak relevant answers, clarification and uncertainty',async()=>{
 const inputs=[]
 const ai=createAI(getConfig({DEMO_MODE:'false',OPENAI_API_KEY:'fixture'}),async(_url,options)=>{
  const request=JSON.parse(options.body);inputs.push({instructions:request.instructions,data:JSON.parse(request.input)})
  return new Response(JSON.stringify({output:[{content:[{type:'output_text',text:JSON.stringify({offTopic:false,topicQuote:'',aside:''})}]}]}))
 })
 const question={text:'What is your pet project about?',concept:'Pets'}
 assert.equal((await ai.classifyOffTopic(question,'I love my dog.',{concepts:[{name:'Pets',evidence:'I built a project about dogs.'}]})).offTopic,false)
 assert.deepEqual(inputs[0].data.sourceEvidence,['I built a project about dogs.']);assert.match(inputs[0].instructions,/Wrong answers, weak reasoning/);assert.match(inputs[0].instructions,/distress or requests for help/)
 await ai.classifyOffTopic(question,"I don't know",{});assert.equal(inputs.length,1)
 assert.match(offTopicFeedback({count:2,language:'hu'}),/tanárodnak/)
})
