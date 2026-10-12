import {getSession,sessionView,finalizeReport} from './flow.js'
import {HttpError} from './extract.js'
import {now} from './db.js'
export function installInterviewLifecycle(app,db,ai,busy){
 const running=new Set()
 const read=session=>JSON.parse(session.meeting||'{}')
 const save=(id,meeting)=>db.prepare('UPDATE sessions SET meeting=? WHERE id=?').run(JSON.stringify(meeting),id)
 function draft(session,body,meeting){if(typeof body.draftText==='string'&&body.draftText.length<=12000&&body.questionId===session.current.id)meeting.draft={questionId:session.current.id,text:body.draftText,at:now()}}
 async function end(id,reason='Student left the interview'){
  const key='session:'+id;if(busy.has(key)||running.has(id))return false
  const session=getSession(db,id);if(!['active','held','reporting'].includes(session.status))return true
  busy.add(key);running.add(id)
  try{
   const meeting=read(session);meeting.endedForDeparture=true;meeting.endedReason=reason;meeting.endedAt=meeting.endedAt||now();meeting.lifecycle={...meeting.lifecycle,departingAt:null};save(id,meeting)
   db.prepare("UPDATE sessions SET status='reporting' WHERE id=?").run(id)
   try{await finalizeReport(db,ai,id)}catch(e){const fresh=read(getSession(db,id));fresh.reportError=e.message;save(id,fresh)}
   return true
  }finally{busy.delete(key);running.delete(id)}
 }
 function sweep(){
  const rows=db.prepare("SELECT id,meeting FROM sessions WHERE status IN ('active','held')").all()
  for(const row of rows){const lease=JSON.parse(row.meeting||'{}').lifecycle;if(!lease?.lastSeen)continue
   const elapsed=Date.now()-Date.parse(lease.lastSeen),departed=lease.departingAt&&Date.now()-Date.parse(lease.departingAt)>=10000
   if(departed||elapsed>=30000)end(row.id,departed?'Student left the interview':'Interview connection ended').catch(()=>{})
  }
 }
 const timer=setInterval(()=>{try{sweep()}catch{clearInterval(timer)}},2000);timer.unref();app.locals.stopInterviewLifecycle=()=>clearInterval(timer)
 app.post('/api/sessions/:id/presence',(req,res)=>{
  const session=getSession(db,req.params.id);if(!['active','held'].includes(session.status))return res.json({open:false})
  const meeting=read(session);draft(session,req.body,meeting)
  if(req.body.departing===true)meeting.lifecycle={...meeting.lifecycle,lastSeen:meeting.lifecycle?.lastSeen||now(),departingAt:now()}
  else meeting.lifecycle={lastSeen:now(),departingAt:null}
  save(session.id,meeting);res.json({open:true})
 })
 app.post('/api/sessions/:id/leave',async(req,res)=>{
  const session=getSession(db,req.params.id),meeting=read(session);draft(session,req.body,meeting);meeting.lifecycle={...meeting.lifecycle,lastSeen:now(),departingAt:new Date(Date.now()-10001).toISOString()};save(session.id,meeting)
  if(!await end(session.id))throw new HttpError(409,'Your response is saving. Try leaving again in a moment.')
  res.json(sessionView(db,session.id))
 })
 app.locals.sweepInterviewLifecycle=sweep
 app.locals.endInterview=end
}
