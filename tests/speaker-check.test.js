import {test} from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {createSpeakerMismatchTracker} from '../shared/speaker-check.js'
import {createObservationTracker} from '../shared/camera-observations.js'
import {setup} from './helpers.js'
import {meetingMessages} from '../shared/meeting-copy.js'
const sample=(time,extra={})=>({enabled:true,level:.2,mouthReady:true,mouthMoving:false,face:true,frameAt:time,...extra})

test('three seconds of audio without motion flags; real motion, silence, inactive turns and stale frames do not',()=>{
 const tracker=createSpeakerMismatchTracker()
 assert.equal(tracker.sample(sample(0),0).flag,false);assert.equal(tracker.sample(sample(2900),2900).flag,false);assert.equal(tracker.sample(sample(3000),3000).flag,true)
 for(const extra of [{mouthMoving:true},{level:0},{enabled:false},{face:false},{mouthReady:false},{frameAt:0}]){
  tracker.reset();tracker.sample(sample(0),0);assert.equal(tracker.sample(sample(4000,extra),4000).flag,false)
 }
 tracker.reset();tracker.sample(sample(0),0);tracker.sample(sample(2000,{mouthMoving:true}),2000);assert.equal(tracker.sample(sample(4000),4000).flag,false)
})

test('camera summarizes lip opening changes without storing landmarks and does not assume tracking is available',()=>{
 const tracker=createObservationTracker(()=>{}),ctx={active:true,phase:'answer',questionId:'q1',handsEnabled:false}
 const camera=(opening)=>({face:true,pose:{yaw:0,pitch:0},mouth:{opening,stretch:.5}})
 let state;for(let time=0;time<=2200;time+=200)state=tracker.sample(camera(.04),time,ctx)
 assert.equal(state.mouthReady,true);assert.equal(state.mouthMoving,false)
 state=tracker.sample(camera(.12),2400,ctx);assert.equal(state.mouthMoving,true)
 state=tracker.sample({face:true,pose:{yaw:0,pitch:0}},2600,ctx);assert.equal(state.mouthReady,false)
})

test('first mismatch pauses the same question; repetition holds for teacher review and keeps answers/draft/grades',async t=>{
 const app=await setup(t);let session=(await app.submit()).data
 session=(await app.request('/sessions/'+session.id+'/meeting',{method:'POST',body:{autoVoice:false,faceVisible:true,identityStatus:'matched'}})).data
 await app.request('/sessions/'+session.id+'/present',{method:'POST',body:{questionId:session.question.id}})
 const event=(type,extra={})=>app.request('/sessions/'+session.id+'/meeting/event',{method:'POST',body:{type,eventId:randomUUID(),questionId:session.question.id,...extra}})
 assert.equal((await event('speaker-mismatch',{durationSeconds:2})).status,400)
 await app.request('/sessions/'+session.id+'/meeting/draft',{method:'POST',body:{questionId:session.question.id,text:'My answer draft stays saved.'}})
 const eventId=randomUUID(),body={type:'speaker-mismatch',eventId,questionId:session.question.id,durationSeconds:3}
 const first=await app.request('/sessions/'+session.id+'/meeting/event',{method:'POST',body});assert.equal(first.status,200);assert.equal(first.data.meeting.warning,'speaker-mismatch');assert.equal(first.data.meeting.speakerCount,1);assert.equal(first.data.status,'active')
 await app.request('/sessions/'+session.id+'/meeting/event',{method:'POST',body});assert.equal((await app.request('/sessions/'+session.id)).data.meeting.speakerCount,1)
 assert.equal((await app.answer(session,'Unverified answer')).status,409)
 await event('warning-resume')
 const held=(await event('speaker-mismatch',{durationSeconds:3})).data;assert.equal(held.status,'held');assert.equal(held.question.id,session.question.id);assert.equal(held.meeting.draft.text,'My answer draft stays saved.');assert.equal(held.answered,0);assert.equal(held.defenceSkipped,false)
 assert.equal(app.db.prepare('SELECT COUNT(*) n FROM activity_events WHERE session_id=? AND type=?').get(session.id,'meeting-speaker-warning').n,2)
 const resumed=(await app.request('/sessions/'+session.id+'/meeting/review',{method:'POST',body:{decision:'resume',reviewed:true,notes:'Checked camera lag and asked the student to retry.'}})).data
 assert.equal(resumed.status,'active');assert.equal(resumed.question.id,session.question.id);assert.equal(resumed.meeting.speakerCount,0)
 assert.match(meetingMessages('hu')['speaker-mismatch'],/szád/)
})

test('no-camera and stale-question speaker events cannot generate a warning',async t=>{
 const app=await setup(t);let session=(await app.submit()).data
 session=(await app.request('/sessions/'+session.id+'/meeting',{method:'POST',body:{autoVoice:false,cameraUnavailable:true}})).data
 await app.request('/sessions/'+session.id+'/present',{method:'POST',body:{questionId:session.question.id}})
 const result=await app.request('/sessions/'+session.id+'/meeting/event',{method:'POST',body:{type:'speaker-mismatch',eventId:randomUUID(),questionId:session.question.id,durationSeconds:3}})
 assert.equal(result.status,409);assert.equal((await app.request('/sessions/'+session.id)).data.meeting.speakerCount,undefined)
})
