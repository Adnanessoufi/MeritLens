import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { supportedTransferOriginal, setup } from './helpers.js'
import { createAI } from '../server/ai.js'
import { getConfig } from '../server/config.js'
import { benchmarkPairs } from '../shared/transfer-fixtures.js'
const configure=(app,session,extra={})=>app.request('/sessions/'+session.id+'/meeting',{method:'POST',body:{autoVoice:false,faceVisible:true,identityStatus:'matched',...extra}})
const event=(app,session,type,eventId=randomUUID())=>app.request('/sessions/'+session.id+'/meeting/event',{method:'POST',body:{type,eventId,questionId:session.question.id}})

test('meeting uses question-specific windows, preserves the deadline on refresh and retains transfer pairs',async t=>{
 const base=createAI(getConfig({DEMO_MODE:'true'}));const app=await setup(t,{demo:false,openaiKey:'test-only'},{ai:{...base,assessTransferOriginal:supportedTransferOriginal,generateTransferPairs:async()=>benchmarkPairs.slice(0,2)}});await app.request('/assignments/sample-python',{method:'PATCH',body:{challengeMode:'transfer',pairCount:2}});const submitted=await app.submit({challengeMode:'transfer',pairCount:2});assert.equal(submitted.status,201);let session=submitted.data
 session=(await configure(app,session)).data;assert.ok([12,20,25,30].includes(session.duration))
 await app.request('/sessions/'+session.id+'/present',{method:'POST',body:{questionId:session.question.id}})
 const first=(await app.request('/sessions/'+session.id)).data.questionStartedAt
 await configure(app,session);assert.equal((await app.request('/sessions/'+session.id)).data.questionStartedAt,first)
 session=(await app.answer(session)).data;assert.equal(session.duration,25);assert.equal(session.question.stage,'apply')
 assert.equal((await app.request('/sessions/'+session.id+'/more-time',{method:'POST',body:{questionId:session.question.id}})).status,409)
})

test('first tab departure has a seven-second deadline; a repeated departure holds without disqualification',async t=>{
 const app=await setup(t);let {data:session}=await app.submit();session=(await configure(app,session)).data
 const eventId=randomUUID();await event(app,session,'tab-away',eventId);await event(app,session,'tab-away',eventId)
 let data=(await app.request('/sessions/'+session.id)).data;assert.equal(data.meeting.tabCount,1);assert.ok(Date.parse(data.meeting.tabDeadline)-Date.now()>6000);assert.ok(Date.parse(data.meeting.tabDeadline)-Date.now()<=7000)
 await event(app,session,'tab-return');await event(app,session,'warning-resume')
 data=(await event(app,session,'tab-away')).data;assert.equal(data.status,'held');assert.equal(data.meeting.tabCount,2)
 assert.ok(data.question);assert.equal(data.reportId,null);assert.equal(data.defenceSkipped,false)
 assert.equal((await app.answer(session)).status,409)
})

test('expired tab return cannot be bypassed by refresh; teacher review can resume the same question',async t=>{
 const app=await setup(t);let {data:session}=await app.submit();session=(await configure(app,session)).data
 await event(app,session,'tab-away')
 const meeting=JSON.parse(app.db.prepare('SELECT meeting FROM sessions WHERE id = ?').get(session.id).meeting);meeting.tabDeadline=new Date(Date.now()-100).toISOString()
 app.db.prepare('UPDATE sessions SET meeting = ? WHERE id = ?').run(JSON.stringify(meeting),session.id)
 const held=(await app.request('/sessions/'+session.id)).data;assert.equal(held.status,'held')
 const review='/sessions/'+session.id+'/meeting/review'
 assert.equal((await app.request(review,{method:'POST',body:{decision:'resume',reviewed:false,notes:'Camera setup problem'}})).status,400)
 const resumed=(await app.request(review,{method:'POST',body:{decision:'resume',reviewed:true,notes:'I checked the camera and discussed the interruption.'}})).data
 assert.equal(resumed.status,'active');assert.equal(resumed.question.id,session.question.id);assert.equal(resumed.meeting.epoch,1);assert.equal(resumed.meeting.tabCount,0)
})

test('repeated framing observations stop for review and preserve the draft; only a human closes the attempt',async t=>{
 const app=await setup(t);let {data:session}=await app.submit();session=(await configure(app,session)).data
 await app.request('/sessions/'+session.id+'/meeting/draft',{method:'POST',body:{questionId:session.question.id,text:'My current explanation is preserved.'}})
 await event(app,session,'head-turned');await event(app,session,'warning-resume')
 const held=(await event(app,session,'head-turned')).data;assert.equal(held.status,'held')
 const review=(await app.request('/sessions/'+session.id+'/meeting/review')).data
 assert.equal(review.meeting.draft.text,'My current explanation is preserved.');assert.match(review.identity,/not official ID verification/)
 const closed=(await app.request('/sessions/'+session.id+'/meeting/review',{method:'POST',body:{decision:'end',reviewed:true,notes:'We agreed to close this demonstration and review the submitted work.'}})).data
 assert.equal(closed.status,'completed');assert.ok(closed.reportId);assert.equal(closed.meeting.endedForReview,true)
})

test('an evaluation already in flight cannot overwrite a review hold or a teacher resume',async t=>{
 const base=createAI(getConfig({DEMO_MODE:'true'}));let release
 const app=await setup(t,{}, {ai:{...base,evaluate:async()=>await new Promise(resolve=>{release=resolve})}})
 let {data:session}=await app.submit();session=(await configure(app,session)).data
 const answering=app.answer(session)
 for(let i=0;i<50&&!release;i++)await new Promise(resolve=>setTimeout(resolve,10))
 assert.ok(release)
 await event(app,session,'head-turned');await event(app,session,'head-turned')
 await app.request('/sessions/'+session.id+'/meeting/review',{method:'POST',body:{decision:'resume',reviewed:true,notes:'Resume after discussing the technical interruption.'}})
 release({status:'DEMONSTRATED',explanation:'Meaningful reasoning.'})
 const result=await answering
 assert.equal(result.data.status,'active');assert.equal(result.data.answered,0);assert.equal(result.data.meeting.epoch,1)
 assert.equal(result.data.meeting.draft.questionId,session.question.id)
})

test('a camera reminder and its frozen response window survive refresh until acknowledged',async t=>{
 const app=await setup(t);let {data:session}=await app.submit();session=(await configure(app,session)).data
 await app.request('/sessions/'+session.id+'/present',{method:'POST',body:{questionId:session.question.id}})
 await event(app,session,'face-missing')
 const paused=(await app.request('/sessions/'+session.id)).data;assert.equal(paused.meeting.warning,'face-missing');assert.ok(paused.meeting.pausedAt)
 await configure(app,session)
 assert.equal((await app.request('/sessions/'+session.id)).data.meeting.warning,'face-missing')
 const resumed=(await event(app,session,'warning-resume')).data;assert.equal(resumed.meeting.warning,null);assert.equal(resumed.meeting.pausedAt,null)
})

test('joining requires a visible face and a successful reference check; students cannot choose room/timing',async t=>{
 const app=await setup(t);const {data:session}=await app.submit();const path='/sessions/'+session.id+'/meeting'
 assert.equal((await app.request(path,{method:'POST',body:{faceVisible:false,identityStatus:'matched'}})).status,409)
 assert.equal((await app.request(path,{method:'POST',body:{faceVisible:true,identityStatus:'review-required'}})).status,409)
 assert.equal((await app.request(path,{method:'POST',body:{faceVisible:true,identityStatus:'matched',answerSeconds:60}})).status,400)
 assert.equal((await app.request(path,{method:'POST',body:{faceVisible:true,identityStatus:'matched',enabled:false}})).status,400)
 assert.equal((await configure(app,session)).status,200)
})

test('an inconclusive reference check permits only a reviewed human override and never disqualifies',async t=>{
 const app=await setup(t);const {data:session}=await app.submit()
 const held=(await app.request('/sessions/'+session.id+'/meeting/identity-review',{method:'POST',body:{}})).data
 assert.equal(held.status,'held');assert.equal(held.defenceSkipped,false)
 const resumed=(await app.request('/sessions/'+session.id+'/meeting/review',{method:'POST',body:{decision:'resume',reviewed:true,notes:'I compared the supplied reference with the student and checked the camera lighting.'}})).data
 assert.equal(resumed.meeting.identityOverride,true)
 assert.equal((await app.request('/sessions/'+session.id+'/meeting',{method:'POST',body:{faceVisible:true,identityStatus:'review-required',autoVoice:false}})).status,200)
})

test('explicit no-camera demo fallback joins without claiming a face match',async t=>{
 const app=await setup(t);const {data:session}=await app.submit()
 const join=await app.request('/sessions/'+session.id+'/meeting',{method:'POST',body:{autoVoice:false,cameraUnavailable:true,faceVisible:false,identityStatus:'off'}})
 assert.equal(join.status,200);assert.equal(join.data.meeting.cameraUnavailable,true);assert.equal(join.data.meeting.identityNotChecked,true);assert.equal(join.data.meeting.identityReportedStatus,'not-checked');assert.notEqual(join.data.meeting.identityOverride,true)
})


test('the first phone observation holds immediately and preserves the current question and draft',async t=>{
 const app=await setup(t);let {data:session}=await app.submit();session=(await configure(app,session)).data
 await app.request('/sessions/'+session.id+'/meeting/draft',{method:'POST',body:{questionId:session.question.id,text:'Keep this unfinished answer.'}})
 const held=(await event(app,session,'phone-visible')).data
 assert.equal(held.status,'held');assert.equal(held.meeting.cameraCounts['phone-visible'],1)
 assert.equal(held.meeting.hold.reason,'Possible phone detected in camera')
 assert.equal(held.question.id,session.question.id);assert.equal(held.meeting.draft.text,'Keep this unfinished answer.')
 assert.equal((await event(app,session,'warning-resume')).data.status,'held')
 assert.equal((await app.answer(session)).status,409);assert.equal(held.defenceSkipped,false)
})

test('looking down uses the direct-camera reminder and survives refresh',async t=>{
 const app=await setup(t);let {data:session}=await app.submit();session=(await configure(app,session)).data
 const result=await app.request('/sessions/'+session.id+'/meeting/event',{method:'POST',body:{type:'head-turned',direction:'down',eventId:randomUUID(),questionId:session.question.id}})
 assert.equal(result.data.meeting.warning,'head-down');assert.equal(result.data.status,'active')
 assert.equal((await app.request('/sessions/'+session.id)).data.meeting.warning,'head-down')
 assert.equal((await event(app,session,'warning-resume')).data.meeting.warning,null)
})


test('up/down/sideways head warnings and leaving frame share a persistent two-camera-warning limit',async t=>{
 const app=await setup(t);let session=(await app.submit()).data;session=(await configure(app,session)).data
 const first=await app.request('/sessions/'+session.id+'/meeting/event',{method:'POST',body:{type:'head-turned',direction:'down',eventId:randomUUID(),questionId:session.question.id}})
 assert.equal(first.data.meeting.warning,'head-down');assert.equal(first.data.status,'active')
 await event(app,session,'warning-resume')
 // A different camera issue must still count as the second warning.
 const held=(await event(app,session,'face-missing')).data
 assert.equal(held.status,'held');assert.equal(held.meeting.hold.reason,'Camera warning limit reached');assert.equal(held.question.id,session.question.id)
 const warnings=app.db.prepare("SELECT details FROM activity_events WHERE session_id=? AND type='meeting-camera-warning' ORDER BY rowid").all(session.id).map(e=>JSON.parse(e.details))
 assert.deepEqual(warnings.map(e=>e.warningNumber),[1,2]);assert.equal(held.meeting.cameraCounts['head-turned'],1);assert.equal(held.meeting.cameraCounts['face-missing'],1)
 assert.equal((await app.request('/sessions/'+session.id)).data.status,'held')
 const resumed=(await app.request('/sessions/'+session.id+'/meeting/review',{method:'POST',body:{decision:'resume',reviewed:true,notes:'Checked camera framing and allowed a retry.'}})).data
 assert.deepEqual(resumed.meeting.cameraCounts,{})
})
