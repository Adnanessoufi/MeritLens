import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {setup} from './helpers.js'
import {createAI} from '../server/ai.js'
import {getConfig} from '../server/config.js'
import {installDemoAssignments} from '../server/demo-assignments.js'
import {selectTransferConcepts} from '../server/transfer.js'
const matlab=readFileSync(new URL('../server/demo-materials/practicing-answers.m',import.meta.url),'utf8')

test('teacher focus is persisted and controls prepared MATLAB pairs in the requested order',async t=>{
 const base=createAI(getConfig({DEMO_MODE:'true'}))
 const app=await setup(t,{demo:false,openaiKey:'fixture'},{ai:{...base,assessSubmission:async()=>null,generateTransferPairs:async()=>{throw Error('Selected prepared pairs must be reused')}}})
 installDemoAssignments(app.db)
 const focus=['y-axis crossing','Slope']
 const saved=await app.request('/assignments/sample-matlab',{method:'PATCH',body:{challengeMode:'transfer',pairCount:2,challengeConcepts:focus}})
 assert.equal(saved.status,200);assert.deepEqual(saved.data.challenge_concepts,focus)
 const response=await app.submit({assignmentId:'sample-matlab',text:matlab})
 assert.equal(response.status,201);assert.equal(response.data.maxQuestions,4);assert.equal(response.data.question.concept,'Y-axis crossing')
 const bank=JSON.parse(app.db.prepare('SELECT bank FROM sessions WHERE id=?').get(response.data.id).bank)
 assert.deepEqual(bank.filter(q=>q.stage==='explain').map(q=>q.concept),['Y-axis crossing','Slope'])
 await app.request('/assignments/sample-matlab',{method:'PATCH',body:{challengeConcepts:['Point on a curve','Slope']}})
 const unchanged=JSON.parse(app.db.prepare('SELECT bank FROM sessions WHERE id=?').get(response.data.id).bank)
 assert.deepEqual(unchanged,bank)
 const invalid=await app.request('/assignments/sample-matlab',{method:'PATCH',body:{challengeConcepts:['Slope','Tangent','Function zeros']}})
 assert.equal(invalid.status,400)
 assert.deepEqual((await app.request('/teacher/assignments/sample-matlab')).data.challenge_concepts,['Point on a curve','Slope'])
})

test('creating and clearing focus does not alter standard prepared questions',async t=>{
 const app=await setup(t);installDemoAssignments(app.db)
 const created=await app.request('/assignments',{method:'POST',body:{title:'Matlab',brief:'Solve the practice task in MATLAB.',challengeConcepts:['Slope','Y-axis crossing']}})
 assert.equal(created.status,201);assert.deepEqual(created.data.challenge_concepts,['Slope','Y-axis crossing'])
 const session=(await app.submit({assignmentId:created.data.id,text:matlab})).data
 assert.equal(session.maxQuestions,5);assert.equal(session.question.concept,'Slope')
 await app.request('/assignments/'+created.data.id,{method:'PATCH',body:{challengeConcepts:[]}})
 assert.deepEqual((await app.request('/teacher/assignments/'+created.data.id)).data.challenge_concepts,[])
})

test('focused concepts require source evidence and use teacher order, independent of capitalisation',()=>{
 const analysis={concepts:[{name:'Slope',evidence:'q4_slope = deltaY/deltaX;'},{name:'Tangent',evidence:'polyder(coefficients)'},{name:'Roots',evidence:'roots(coefficients)'}]}
 assert.deepEqual(selectTransferConcepts(analysis,['tangent','slope'],2,true).map(c=>c.name),['Tangent','Slope'])
 assert.throws(()=>selectTransferConcepts(analysis,['Camera'],2,true),/not found in the uploaded work/)
})
