import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { setup } from './helpers.js'
import { createObservationTracker, poseFromMatrix } from '../shared/camera-observations.js'
const context = { active: true, questionId: 'q1', phase: 'answer', handsEnabled: false }
const visible = { face: true, pose: { yaw: 0, pitch: 0 }, hands: null }
function calibrated(emit) {
 const tracker=createObservationTracker(emit)
 for(let t=0;t<2400;t+=200)tracker.sample(visible,t,{...context,active:false})
 return tracker
}

test('short glances are ignored; sustained turns are attributed and bounded to the answer', () => {
 const events=[];const tracker=calibrated((type,details)=>events.push({type,details}))
 for(let t=2400;t<4200;t+=200)tracker.sample({...visible,pose:{yaw:40,pitch:0}},t,context)
 tracker.sample(visible,4200,context)
 assert.equal(events.filter(e=>e.type==='head-turned').length,0)
 for(let t=4400;t<=8000;t+=200)tracker.sample({...visible,pose:{yaw:40,pitch:0}},t,context)
 tracker.sample(visible,8200,context)
 const turn=events.find(e=>e.type==='head-turned')
 assert.equal(turn.details.questionId,'q1');assert.equal(turn.details.durationSeconds,4)
 const before=events.length
 for(let t=8400;t<14400;t+=200)tracker.sample({...visible,face:false},t,{...context,active:false})
 tracker.flush();assert.equal(events.length,before)
})

test('tracking gaps and question changes do not fabricate long observations; typing excludes hands', () => {
 const events=[];const tracker=calibrated((type,details)=>events.push({type,details}))
 tracker.sample({...visible,face:false},2400,context)
 tracker.sample({...visible,face:false},12000,context)
 tracker.sample(visible,12200,{...context,questionId:'q2'})
 assert.equal(events.filter(e=>e.type==='face-missing').length,0)
 for(let t=12400;t<14000;t+=200)tracker.sample({...visible,hands:2},t,{...context,handsEnabled:true})
 for(let t=14000;t<18400;t+=200)tracker.sample({...visible,hands:0},t,{...context,handsEnabled:true,phase:'typing'})
 tracker.flush();assert.equal(events.filter(e=>e.type==='hands-out-of-frame').length,0)
 assert.ok(events.some(e=>e.type==='hand-check-enabled'))
})

test('unconfirmed hands never produce a hands-missing event and pose handles invalid matrices', () => {
 const events=[];const tracker=calibrated((type,details)=>events.push({type,details}))
 for(let t=2400;t<10000;t+=200)tracker.sample({...visible,hands:0},t,{...context,handsEnabled:true})
 tracker.flush();assert.equal(events.filter(e=>e.type==='hands-out-of-frame').length,0)
 assert.equal(poseFromMatrix(null),null)
 assert.deepEqual(poseFromMatrix([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]),{yaw:0,pitch:-0})
})

test('camera summaries are validated, linked to delivered questions, deduplicated and independent of grading', async t => {
 const app=await setup(t);const {data:session}=await app.submit()
 const path='/sessions/'+session.id+'/activity'
 const send=(type,details,eventId=randomUUID())=>app.request(path,{method:'POST',body:{eventId,type,details}})
 assert.equal((await send('head-turned',{questionId:'future',phase:'answer',durationSeconds:4,direction:'left'})).status,409)
 assert.equal((await send('head-turned',{questionId:session.question.id,phase:'answer',durationSeconds:4,direction:'left',image:'private-frame'})).status,400)
 assert.equal((await send('hands-out-of-frame',{questionId:session.question.id,phase:'typing',durationSeconds:4})).status,400)
 assert.equal((await send('face-missing',{questionId:session.question.id,phase:'answer',durationSeconds:1})).status,400)
 const eventId=randomUUID();const details={questionId:session.question.id,phase:'answer',durationSeconds:6,direction:'left'}
 await send('camera-calibrated',{})
 await send('head-turned',details,eventId);await send('head-turned',details,eventId)
 const activity=(await app.request(path)).data
 assert.equal(activity.cameraObservations.headTurnedSeconds,6)
 assert.equal(activity.cameraObservations.count,1)
 assert.equal(activity.events.find(e=>e.type==='head-turned').details.questionNumber,1)
 const first=(await app.answer(session)).data
 assert.equal((await send('face-missing',{questionId:session.question.id,phase:'answer',durationSeconds:4})).status,200)
 const {data:control}=await app.submit();await app.answer(control)
 const result=app.db.prepare('SELECT status,explanation,rubric FROM answers WHERE session_id = ?').get(first.id)
 const comparison=app.db.prepare('SELECT status,explanation,rubric FROM answers WHERE session_id = ?').get(control.id)
 assert.deepEqual(result,comparison)
})

test('a final-question observation can finish after submission within a bounded completion grace period', async t => {
 const app=await setup(t);let {data:session}=await app.submit();let lastQuestion
 while(session.status==='active'){lastQuestion=session.question.id;session=(await app.answer(session)).data}
 const path='/sessions/'+session.id+'/activity'
 const details={questionId:lastQuestion,phase:'answer',durationSeconds:4}
 await app.request(path,{method:'POST',body:{eventId:randomUUID(),type:'face-missing',details}})
 assert.equal((await app.request(path)).data.cameraObservations.faceMissingSeconds,4)
 app.db.prepare('UPDATE sessions SET completed_at = ? WHERE id = ?').run(new Date(Date.now()-30000).toISOString(),session.id)
 await app.request(path,{method:'POST',body:{eventId:randomUUID(),type:'face-missing',details}})
 assert.equal((await app.request(path)).data.cameraObservations.faceMissingSeconds,4)
})

test('continuous meeting observation catches downward turns and phones during question preparation', () => {
 const events=[];const tracker=calibrated((type,details)=>events.push({type,details}))
 let state
 const ctx={...context,phase:'meeting'}
 for(let t=2400;t<=6200;t+=200)state=tracker.sample({...visible,pose:{yaw:0,pitch:35},phone:true,phoneReady:true},t,ctx)
 assert.ok(state.turnedSeconds>=3);assert.ok(state.phoneSeconds>=3)
 tracker.sample({...visible,phone:false,phoneReady:true},6400,ctx)
 assert.ok(events.some(e=>e.type==='phone-visible'&&e.details.phase==='meeting'))
 assert.ok(events.some(e=>e.type==='head-turned'&&e.details.direction==='down'))
})

test('phone summaries support the complete meeting phase, without images or grade inputs',async t=>{
 const app=await setup(t);const {data:session}=await app.submit()
 const result=await app.request('/sessions/'+session.id+'/activity',{method:'POST',body:{eventId:randomUUID(),type:'phone-visible',details:{questionId:session.question.id,phase:'meeting',durationSeconds:4}}})
 assert.equal(result.status,200);assert.equal(result.data.cameraObservations.phoneVisibleSeconds,4)
 assert.equal((await app.request('/sessions/'+session.id)).data.questionStartedAt,null)
})


test('downward framing reminder reaches its threshold at three continuous seconds, not a short glance',()=>{
 const tracker=calibrated(()=>{})
 const down={...visible,pose:{yaw:0,pitch:35}}
 let state
 for(let t=2400;t<5400;t+=200)state=tracker.sample(down,t,context)
 assert.equal(state.direction,'down');assert.ok(state.turnedSeconds<3)
 state=tracker.sample(down,5400,context);assert.equal(state.turnedSeconds,3)
 state=tracker.sample(visible,5600,context);assert.equal(state.turnedSeconds,0)
})


test('upward and sideways looks, and no detected face, reach the same three-second threshold',()=>{
 for(const [pose,direction] of [[{yaw:0,pitch:-35},'up'],[{yaw:40,pitch:0},'left'],[{yaw:-40,pitch:0},'right']]){
  const tracker=calibrated(()=>{});let state
  for(let t=2400;t<5400;t+=200)state=tracker.sample({...visible,pose},t,context)
  assert.equal(state.direction,direction);assert.ok(state.turnedSeconds<3)
  state=tracker.sample({...visible,pose},5400,context);assert.equal(state.turnedSeconds,3)
 }
 const tracker=calibrated(()=>{});let state
 for(let t=2400;t<5400;t+=200)state=tracker.sample({face:false,pose:null},t,context)
 assert.ok(state.missingSeconds<3);state=tracker.sample({face:false,pose:null},5400,context);assert.equal(state.missingSeconds,3)
})


test('changing the away direction does not reset three continuous seconds away from the camera',()=>{
 const tracker=calibrated(()=>{});let state
 for(let t=2400;t<=5400;t+=200)state=tracker.sample({...visible,pose:t<4000?{yaw:40,pitch:0}:{yaw:0,pitch:-35}},t,context)
 assert.equal(state.direction,'up');assert.equal(state.turnedSeconds,3)
})
