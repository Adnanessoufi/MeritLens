import {test} from 'node:test'
import assert from 'node:assert/strict'
import {PDFParse} from 'pdf-parse'
import {setup} from './helpers.js'
import {installDemoAssignments,demoAssignments} from '../server/demo-assignments.js'
test('all three demo assignments have a simple 20-point rubric',async t=>{
 const app=await setup(t);installDemoAssignments(app.db)
 for(const a of demoAssignments){const {data}=await app.request('/teacher/assignments/'+a.id);assert.ok(data.rubric.length);assert.equal(data.rubric.reduce((n,r)=>n+r.maxPoints,0),20)}
})
test('PDF download includes the actual score, answers and feedback without the private reference',async t=>{
 const app=await setup(t);let session=(await app.submit({student:'Download QA'})).data
 session=(await app.answer(session,'I use keys to find the matching record directly.')).data
 session=(await app.request('/sessions/'+session.id+'/skip-defence',{method:'POST',body:{}})).data
 const grade={score:null,total:20,criteria:[{name:'Design',score:14,maxPoints:14,rationale:'Evidence checked.'},{name:'Testing',score:null,maxPoints:6,rationale:'Missing test evidence.'}]}
 app.db.prepare('UPDATE reports SET grading_result=?, feedback=? WHERE id=?').run(JSON.stringify(grade),'Clarify your design choice.',session.reportId)
 const current=(await app.request('/reports/'+session.reportId)).data;assert.equal(current.gradingResult.score,14);assert.equal(current.gradingResult.criteria[1].score,0)
 const response=await fetch(app.base+'/api/reports/'+session.reportId+'/download')
 assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/application\/pdf/);assert.match(response.headers.get('content-disposition'),/attachment.*\.pdf/)
 const data=Buffer.from(await response.arrayBuffer());assert.equal(data.subarray(0,5).toString(),'%PDF-')
 const parser=new PDFParse({data:new Uint8Array(data)});const parsed=await parser.getText();await parser.destroy()
 for(const value of ['Download QA','14 / 20','0 / 6','AI suggested grade','I use keys','Clarify your design choice.'])assert.ok(parsed.text.includes(value),value)
 assert.ok(!parsed.text.includes('reference_answer'))
 const missing=await fetch(app.base+'/api/reports/missing/download');assert.equal(missing.status,404)
})
