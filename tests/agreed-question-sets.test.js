import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {setup,sample} from './helpers.js'
import {createAI} from '../server/ai.js'
import {getConfig} from '../server/config.js'
import {projectSampleText} from '../shared/project-demo.js'
import {benchmarkPairs} from '../shared/transfer-fixtures.js'
const guide=readFileSync(new URL('./fixtures/agreed-interview-guide.txt',import.meta.url),'utf8').replace(/\r/g,'')
const [standardGuide,transferGuide]=guide.split('TRANSFER MODE - QUESTIONS AND SAMPLE ANSWERS')
const standard=[...standardGuide.matchAll(/^\d+\. ([^\n]+)\nAnswer:/gm)].map(m=>m[1])
const explains=[...transferGuide.matchAll(/^Explain: ([^\n]+)/gm)].map(m=>m[1])
const applies=[...transferGuide.matchAll(/^Apply: ([^\n]+)/gm)].map(m=>m[1])
const sources=[readFileSync(new URL('../server/demo-materials/practicing-answers.m',import.meta.url),'utf8'),'Deepfake Image Detection Using Spatial Rich Models. RGB and SRM use EfficientNet. 20,000 final test images. Ensemble soft-voting. Dataset FFHQ.',projectSampleText]

test('all three demo documents deliver the attached guide verbatim in both modes, even after positive answers',async t=>{
 const base=createAI(getConfig({DEMO_MODE:'true'}));let adaptations=0
 const ai={...base,assessSubmission:async()=>null,generateTransferPairs:async()=>benchmarkPairs,report:async()=>({summary:'Fixture report.',strengths:[],reviewAreas:[],conceptEvidence:[]}),
 evaluate:async(_analysis,_q,text)=>({status:'DEMONSTRATED',addressesQuestion:'yes',accuracy:'correct',reasoning:'explained',application:'not_probed',explanation:'Fixture answer.',evidenceQuote:text,feedback:'Thanks.'}),
 assessTransferOriginal:async(_spec,text)=>({explanationScore:2,originalQuote:text,explanationRationale:'Fixture answer.',feedback:''}),
 assessTransferPair:async(_spec,original,application)=>({assessmentState:'complete',status:'STRONG',explanationScore:2,transferScore:2,consistencyScore:2,originalQuote:original,transferQuote:application,explanationRationale:'Fixture answer.',transferRationale:'Fixture answer.',consistencyRationale:'Fixture answer.',gapFlag:false,nextStep:'Continue.'}),
 adaptInterviewQuestion:async()=>{adaptations++;throw Error('Agreed demo questions must never be rewritten')}}
 const app=await setup(t,{demo:false,openaiKey:'fixture'},{ai})
 let offset=0
 for(let i=0;i<3;i++){
  const expected=standard.slice(offset,offset+(i===0?5:6));offset+=expected.length
  for(const mode of ['standard','transfer']){
   const created=(await app.request('/assignments',{method:'POST',body:{title:'Renamed demo '+i+' '+mode,brief:'Upload the agreed demo work.',challengeMode:mode,pairCount:3}})).data
   let result=await app.submit({assignmentId:created.id,text:sources[i]});assert.equal(result.status,201)
   let session=result.data;const seen=[]
   while(session.question){
    assert.equal(session.question.expectedAnswer,undefined);assert.equal(session.question.pairSpec,undefined)
    seen.push(session.question.text.replace(/\s+/g,' ').trim())
    result=await app.answer(session,'Fixture explanation provided.');assert.equal(result.status,200);session=result.data
   }
   const expectedQuestions=mode==='standard'?expected:explains.slice(i*3,i*3+3).flatMap((q,j)=>[q,applies[i*3+j]])
   assert.deepEqual(seen,expectedQuestions);assert.equal(session.status,'completed')
  }
 }
 assert.equal(adaptations,0)
})

test('demo focus cannot silently generate an unagreed pair, while ordinary assignments retain adaptation',async t=>{
 const base=createAI(getConfig({DEMO_MODE:'true'}));let adaptations=0,generation=0
 const ai={...base,assessSubmission:async()=>null,generateTransferPairs:async()=>{generation++;return benchmarkPairs.slice(0,2)},assessTransferOriginal:async(_s,text)=>({explanationScore:2,originalQuote:text,explanationRationale:'Fixture.',feedback:''}),adaptInterviewQuestion:async(_a,q)=>{adaptations++;return {...q,text:q.text+' QA adaptation'}}}
 const app=await setup(t,{demo:false,openaiKey:'fixture'},{ai})
 const demo=(await app.request('/assignments',{method:'POST',body:{title:'Matlab',brief:'Upload the agreed work.',challengeMode:'transfer',pairCount:2,challengeConcepts:['Tangent']}})).data
 const denied=await app.submit({assignmentId:demo.id,text:sources[0]});assert.equal(denied.status,422);assert.match(denied.data.error,/For this demo challenge/);assert.equal(generation,0)
 await app.request('/assignments/sample-python',{method:'PATCH',body:{challengeMode:'transfer',pairCount:2}})
 let session=(await app.submit({text:sample})).data;session=(await app.answer(session,'I explain this choice.')).data
 assert.equal(adaptations,1);assert.match(session.question.text,/QA adaptation/)
})
