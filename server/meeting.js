import {cameraWarningCount} from '../shared/camera-observations.js'
import { meetingQuestionDuration } from '../shared/meeting-timer.js'
import { id, now } from './db.js'
import { getSession, sessionView, finalizeReport } from './flow.js'
import { HttpError } from './extract.js'
import { getSpeechIdentity, synthesizeSpeech } from './speech.js'
import {meetingMessages} from '../shared/meeting-copy.js'
export const readMeeting = session => JSON.parse(session.meeting || '{}')
function save(db, sessionId, meeting) { db.prepare('UPDATE sessions SET meeting = ? WHERE id = ?').run(JSON.stringify(meeting),sessionId) }
function log(db, sessionId, type, details = {}) { db.prepare('INSERT INTO activity_events (id,session_id,type,created_at,details) VALUES (?,?,?,?,?)').run(id(),sessionId,type,now(),JSON.stringify(details)) }
function hold(db, session, meeting, reason) {
 if(session.status !== 'active')return
 meeting.hold={reason,at:now()};meeting.warning='held';meeting.tabDeadline=null
 meeting.history=[...(meeting.history||[]),{type:'hold',reason,at:now()}].slice(-30)
 save(db,session.id,meeting);db.prepare("UPDATE sessions SET status = 'held' WHERE id = ?").run(session.id)
 log(db,session.id,'meeting-held',{reason})
}
export function enforceMeetingDeadline(db,sessionId) {
 const session=getSession(db,sessionId), meeting=readMeeting(session)
 if(session.status==='active'&&meeting.enabled&&cameraWarningCount(meeting)>=2){hold(db,session,meeting,'Camera warning limit reached');return}
 if(session.status==='active' && meeting.enabled && meeting.tabDeadline && Date.now()>=Date.parse(meeting.tabDeadline))hold(db,session,meeting,'Tab return window expired')
}
export function installMeetingRoutes(app,db,config,ai,request) {
 const audioCache=new Map()
 app.post('/api/sessions/:id/meeting', (req,res)=>{
  const session=getSession(db,req.params.id)
  if(session.status!=='active')throw new HttpError(409,'This session is not open.')
  const enabled=true,autoVoice=req.body.autoVoice!==false,old=readMeeting(session)
  if(req.body.enabled===false || req.body.answerSeconds!==undefined)throw new HttpError(400,'The room and response timing are chosen by the interview, not the student.')
  const noCamera=req.body.cameraUnavailable===true||(req.body.cameraUnavailable===undefined&&old.cameraUnavailable===true)
  const identityApproved=noCamera||old.identityOverride===true||old.cameraExceptionApproved===true
  if(!noCamera && req.body.faceVisible!==true && old.cameraExceptionApproved!==true)throw new HttpError(409,'A visible face is required before joining.')
  if(!identityApproved && req.body.identityStatus!=='matched')throw new HttpError(409,'The reference comparison needs teacher review before joining.')
  const upgrading=old.budgetMode!=='adaptive'
  const answerSeconds=old.enabled&&!upgrading&&session.question_started_at?session.duration:meetingQuestionDuration(session.current)
  const meeting={...old,enabled,answerSeconds,budgetMode:'adaptive',cameraUnavailable:noCamera,identityNotChecked:noCamera,identityReportedStatus:noCamera?'not-checked':req.body.identityStatus||'teacher-approved',autoVoice,tabCount:old.enabled?old.tabCount||0:0,cameraCounts:old.enabled?old.cameraCounts||{}:{},epoch:old.epoch||0,history:old.history||[],startedAt:old.startedAt||now()}
  if(enabled && !old.originalTiming)meeting.originalTiming={duration:session.duration,base:session.base_duration,mode:session.timing_mode}
  save(db,session.id,meeting)
  if(enabled && (!old.enabled || upgrading || !session.question_started_at))db.prepare("UPDATE sessions SET duration = ?, base_duration = ?, timing_mode = 'adaptive', question_started_at = NULL, response_ended_at = NULL WHERE id = ?").run(answerSeconds,answerSeconds,session.id)
  else if(!enabled && old.originalTiming)db.prepare('UPDATE sessions SET duration = ?, base_duration = ?, timing_mode = ? WHERE id = ?').run(old.originalTiming.duration,old.originalTiming.base,old.originalTiming.mode,session.id)
  res.json(sessionView(db,session.id))
 })
 app.post('/api/sessions/:id/meeting/identity-review',(req,res)=>{
  const session=getSession(db,req.params.id),meeting=readMeeting(session)
  if(session.status!=='active')throw new HttpError(409,'This session is not open.')
  meeting.identityReview='pending'
  hold(db,session,meeting,req.body.cameraUnavailable===true?'Unavailable camera exception requires teacher review':'Reference photo comparison requires human identity review')
  res.json(sessionView(db,session.id))
 })
 app.post('/api/sessions/:id/meeting/event',(req,res)=>{
  enforceMeetingDeadline(db,req.params.id)
  const session=getSession(db,req.params.id),meeting=readMeeting(session)
  if(!meeting.enabled || !['active','held'].includes(session.status))throw new HttpError(409,'The meeting is not open.')
  const allowed=['tab-away','tab-return','face-missing','head-turned','hands-out-of-frame','phone-visible','timeout','warning-resume','identity-review','speaker-mismatch']
  if(!allowed.includes(req.body.type))throw new HttpError(400,'Unsupported meeting event.')
  const eventId=req.body.eventId
  if(typeof eventId!=='string'||!/^[a-zA-Z0-9-]{10,80}$/.test(eventId))throw new HttpError(400,'Invalid meeting event ID.')
  meeting.seen=meeting.seen||[]
  if(meeting.seen.includes(eventId)||session.status==='held')return res.json(sessionView(db,session.id))
  meeting.seen=[...meeting.seen,eventId].slice(-100)
  if(req.body.type!=='phone-visible' && req.body.questionId && req.body.questionId!==session.current.id)throw new HttpError(409,'This question has changed.')
  if(req.body.type==='speaker-mismatch'){
   if(meeting.cameraUnavailable||!session.question_started_at)throw new HttpError(409,'The speaker check needs an active answer and visible camera.')
   if(!Number.isInteger(req.body.durationSeconds)||req.body.durationSeconds<3||req.body.durationSeconds>300)throw new HttpError(400,'The speaker observation needs at least three seconds.')
   if(meeting.warning)return res.json(sessionView(db,session.id))
   meeting.speakerCount=(meeting.speakerCount||0)+1
   log(db,session.id,'meeting-speaker-warning',{questionId:session.current.id,durationSeconds:req.body.durationSeconds,reason:'Microphone activity without visible mouth movement'})
   if(meeting.speakerCount>=2)hold(db,session,meeting,'Repeated audio without visible mouth movement')
   else {meeting.warning='speaker-mismatch';meeting.pausedAt=now();save(db,session.id,meeting)}
   return res.json(sessionView(db,session.id))
  }
  if(req.body.type==='identity-review'){meeting.identityReview='pending';hold(db,session,meeting,'Reference photo comparison requires human identity review')}else if(req.body.type==='phone-visible'){
   meeting.cameraCounts=meeting.cameraCounts||{};meeting.cameraCounts['phone-visible']=(meeting.cameraCounts['phone-visible']||0)+1
   hold(db,session,meeting,'Possible phone detected in camera')
  }else if(req.body.type==='tab-away'){
   meeting.tabCount=(meeting.tabCount||0)+1
   if(meeting.tabCount>=2)hold(db,session,meeting,'Repeated interview tab departure')
   else {meeting.warning='tab-warning';meeting.pausedAt=now();meeting.tabDeadline=new Date(Date.now()+7000).toISOString();save(db,session.id,meeting);log(db,session.id,'meeting-tab-warning')}
  }else if(req.body.type==='tab-return'){
   meeting.tabDeadline=null;save(db,session.id,meeting)
  }else if(req.body.type==='warning-resume'){
   if(meeting.pausedAt && session.question_started_at){const start=new Date(Date.parse(session.question_started_at)+Date.now()-Date.parse(meeting.pausedAt)).toISOString();db.prepare('UPDATE sessions SET question_started_at = ?, response_ended_at = NULL WHERE id = ?').run(start,session.id)}
   meeting.warning=null;meeting.pausedAt=null;save(db,session.id,meeting)
  }else if(req.body.type==='timeout'){
   save(db,session.id,meeting);log(db,session.id,'answer-timeout',{questionId:session.current.id})
  }else{
   meeting.cameraCounts=meeting.cameraCounts||{};meeting.cameraCounts[req.body.type]=(meeting.cameraCounts[req.body.type]||0)+1
   const cameraWarnings=cameraWarningCount(meeting)
   log(db,session.id,'meeting-camera-warning',{reason:req.body.type,...(req.body.type==='head-turned'?{direction:req.body.direction}:{}),questionId:session.current.id,warningNumber:cameraWarnings})
   if(cameraWarnings>=2)hold(db,session,meeting,'Camera warning limit reached')
   else {meeting.warning=req.body.type==='head-turned'&&req.body.direction==='down'?'head-down':req.body.type;meeting.pausedAt=now();save(db,session.id,meeting)}
  }
  res.json(sessionView(db,session.id))
 })
 app.post('/api/sessions/:id/meeting/draft',(req,res)=>{
  const session=getSession(db,req.params.id)
  if(!['active','held'].includes(session.status)||req.body.questionId!==session.current.id)throw new HttpError(409,'This response is no longer current.')
  if(typeof req.body.text!=='string'||req.body.text.length>12000)throw new HttpError(400,'Keep the response under 12000 characters.')
  const meeting=readMeeting(session);meeting.draft={questionId:session.current.id,text:req.body.text,at:now()};save(db,session.id,meeting);res.json({saved:true})
 })
 app.post('/api/sessions/:id/meeting/voice',async(req,res)=>{
  const session=getSession(db,req.params.id)
  const text=meetingMessages(session.language)[req.body.message]
  if(!text)throw new HttpError(400,'Choose an interviewer reminder.')
  const key=getSpeechIdentity(config)+':'+text
  if(!audioCache.has(key)){const pending=synthesizeSpeech(config,text,request).catch(error=>{audioCache.delete(key);throw error});audioCache.set(key,pending)}
  res.type('audio/mpeg').send(await audioCache.get(key))
 })
 app.get('/api/sessions/:id/meeting/review',(req,res)=>{
  enforceMeetingDeadline(db,req.params.id)
  const session=getSession(db,req.params.id)
  res.json({session:sessionView(db,session.id),meeting:readMeeting(session),answers:db.prepare('SELECT position,question,transcript FROM answers WHERE session_id = ? ORDER BY position').all(session.id),identity:readMeeting(session).identityOverride?'Teacher approved reference-check exception · not official ID verification':readMeeting(session).identityReportedStatus==='matched'?'Local one-to-one reference match reported · not official ID verification':'Not verified · human ID review required'})
 })
 app.post('/api/sessions/:id/meeting/review',async(req,res)=>{
  const session=getSession(db,req.params.id),meeting=readMeeting(session)
  if(session.status!=='held')throw new HttpError(409,'This session is not awaiting a meeting review.')
  if(!['resume','end'].includes(req.body.decision)||req.body.reviewed!==true||typeof req.body.notes!=='string'||!req.body.notes.trim()||req.body.notes.length>1000)throw new HttpError(400,'Review the circumstances and write an explanation before deciding.')
  meeting.history=[...(meeting.history||[]),{type:req.body.decision,at:now(),notes:req.body.notes}].slice(-30)
  meeting.reviewExplanation=req.body.notes
  if(req.body.decision==='resume'){
   if(meeting.hold?.reason?.includes('identity review')){meeting.identityOverride=true;meeting.identityReview='teacher-approved'}
   if(meeting.hold?.reason?.includes('camera exception'))meeting.cameraExceptionApproved=true
   meeting.hold=null;meeting.warning=null;meeting.pausedAt=null;meeting.tabCount=0;meeting.cameraCounts={};meeting.speakerCount=0;meeting.tabDeadline=null;meeting.epoch=(meeting.epoch||0)+1
   if(meeting.lifecycle)meeting.lifecycle={lastSeen:now(),departingAt:null}
   save(db,session.id,meeting);db.prepare("UPDATE sessions SET status = 'active', question_started_at = NULL, response_ended_at = NULL WHERE id = ?").run(session.id);log(db,session.id,'meeting-resumed')
  }else{
   meeting.endedForReview=true;save(db,session.id,meeting);db.prepare("UPDATE sessions SET status = 'reporting' WHERE id = ?").run(session.id);log(db,session.id,'meeting-ended');await finalizeReport(db,ai,session.id)
  }
  res.json(sessionView(db,session.id))
 })
}
