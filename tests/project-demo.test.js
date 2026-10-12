import {test} from 'node:test'
import assert from 'node:assert/strict'
import {setup} from './helpers.js'
import {installDemoAssignments} from '../server/demo-assignments.js'
import {projectSampleText,PROJECT_DEMO_ID} from '../shared/project-demo.js'

test('curated assignments contain the real MATLAB task/20 points and an editable project sample, without restoring deleted courses',async t=>{
 const app=await setup(t);installDemoAssignments(app.db)
 const math=(await app.request('/teacher/assignments/sample-matlab')).data
 assert.equal(math.rubric.reduce((n,r)=>n+r.maxPoints,0),20)
 assert.match(math.instructions_text,/3\*x\^6/);assert.match(math.reference_answer,/q3_coefficients/)
 const publicMath=(await app.request('/assignments/sample-matlab')).data;assert.equal(publicMath.reference_answer,undefined)
 await app.request('/assignments/'+PROJECT_DEMO_ID,{method:'DELETE'});installDemoAssignments(app.db)
 assert.ok(app.db.prepare('SELECT deleted_at FROM assignments WHERE id=?').get(PROJECT_DEMO_ID).deleted_at)
})

test('project interview uses the normal short independent defence, including legacy extended sessions',async t=>{
 const app=await setup(t);installDemoAssignments(app.db)
 let session=(await app.submit({assignmentId:PROJECT_DEMO_ID,text:projectSampleText})).data
 assert.equal(session.maxQuestions,6)
 const denied=await app.submit({assignmentId:PROJECT_DEMO_ID,text:projectSampleText,questionLimit:20});assert.equal(denied.status,409)
 const extended=await app.request('/assignments/'+PROJECT_DEMO_ID,{method:'PATCH',body:{questionLimit:20}});assert.equal(extended.status,400)
 // A session saved before the correction must follow the same six-question ceiling.
 app.db.prepare('UPDATE sessions SET question_limit=20 WHERE id=?').run(session.id)
 session=(await app.request('/sessions/'+session.id)).data
 assert.equal(session.maxQuestions,6)
 let turns=0
 while(session.status==='active'&&turns<6){
  session=(await app.answer(session,'Our project helps teachers check understanding by asking questions about submitted work. The teacher reviews the answers and decides what feedback to release. This lets a teacher inspect the actual reasoning rather than assume that a polished submission proves understanding.')).data
  assert.equal(session.answered,++turns)
 }
 assert.ok(turns>=3&&turns<=6);assert.equal(session.status,'completed');assert.ok(session.reportId)
 const record=(await app.request('/reports/'+session.reportId)).data
 assert.equal(record.answers.length,turns);assert.equal(new Set(record.answers.map(a=>a.question_id)).size,turns)
})
