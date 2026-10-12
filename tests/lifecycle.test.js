import {test} from 'node:test'
import assert from 'node:assert/strict'
import {setup} from './helpers.js'
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))
test('assignment deletion is reversible, removes it from selection and preserves existing reports',async t=>{
 const app=await setup(t);let {data:session}=await app.submit()
 assert.equal((await app.request('/assignments/sample-python',{method:'DELETE'})).status,200)
 assert.equal((await app.request('/assignments')).data.length,0)
 assert.equal((await app.submit()).status,410)
 while(session.status==='active')session=(await app.answer(session)).data
 assert.equal((await app.request('/reports/'+session.reportId+'/receipt')).data.matches,true)
 assert.equal((await app.request('/submissions')).data.length,0)
 await app.request('/assignments/sample-python/restore',{method:'POST',body:{}})
 assert.equal((await app.request('/assignments')).data.length,1)
 assert.equal((await app.request('/submissions')).data.length,1)
})
test('a departed interview closes with incomplete evidence while a refresh can cancel departure',async t=>{
 const app=await setup(t);const {data:session}=await app.submit()
 await app.request('/sessions/'+session.id+'/presence',{method:'POST',body:{}})
 await app.request('/sessions/'+session.id+'/presence',{method:'POST',body:{departing:true}})
 await app.request('/sessions/'+session.id+'/presence',{method:'POST',body:{}})
 let meeting=JSON.parse(app.db.prepare('SELECT meeting FROM sessions WHERE id=?').get(session.id).meeting)
 assert.equal(meeting.lifecycle.departingAt,null)
 app.app?.locals?.sweepInterviewLifecycle?.()
 assert.equal((await app.request('/sessions/'+session.id)).data.status,'active')
 await app.request('/sessions/'+session.id+'/presence',{method:'POST',body:{departing:true}})
 meeting=JSON.parse(app.db.prepare('SELECT meeting FROM sessions WHERE id=?').get(session.id).meeting);meeting.lifecycle.departingAt=new Date(Date.now()-15000).toISOString()
 app.db.prepare('UPDATE sessions SET meeting=? WHERE id=?').run(JSON.stringify(meeting),session.id)
 // The service sweeps at two-second intervals.
 let ended
 for(let i=0;i<30;i++){await pause(100);ended=(await app.request('/sessions/'+session.id)).data;if(ended.status==='completed')break}
 assert.equal(ended.status,'completed');assert.equal(ended.meeting.endedForDeparture,true);assert.equal(ended.answered,0)
 const report=(await app.request('/reports/'+ended.reportId)).data;assert.equal(report.answers.length,0);assert.match(report.summary,/No conclusion/)
})
test('explicit leaving retains an unsubmitted draft without scoring it as an answer',async t=>{
 const app=await setup(t);const {data:session}=await app.submit()
 const ended=await app.request('/sessions/'+session.id+'/leave',{method:'POST',body:{questionId:session.question.id,draftText:'An unfinished explanation about dictionary keys.'}})
 assert.equal(ended.status,200);assert.equal(ended.data.status,'completed');assert.equal(ended.data.answered,0)
 const report=(await app.request('/reports/'+ended.data.reportId)).data
 assert.equal(report.meeting.draft.text,'An unfinished explanation about dictionary keys.');assert.equal(report.answers.length,0);assert.equal(report.evidenceReceipt.matches,true)
})
