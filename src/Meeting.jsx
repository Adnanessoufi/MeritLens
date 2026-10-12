import {cameraWarningCount} from '../shared/camera-observations.js'
import React, { useEffect, useRef, useState } from 'react'
import { api, useResource, navigate } from './api.js'
import { Button, ErrorNotice, Icon, Loading } from './components.jsx'
import { CameraPreview } from './Camera.jsx'
import { CameraObservations } from './CameraObservations.jsx'
import Interviewer from './Interviewer.jsx'
import {meetingMessages} from '../shared/meeting-copy.js'

export function useMeetingRules({session,entered,config,observations,identity,onUpdate}) {
 const messages=meetingMessages(session?.language)
 const [warning,setWarning]=useState(null),[error,setError]=useState(''),[clock,setClock]=useState(Date.now())
 const live=useRef({session,entered,config,observations,onUpdate});live.current={session,entered,config,observations,onUpdate}
 const guard=useRef({alive:true,away:false,armed:new Set(),audio:null,url:null,voiceSequence:0,identityCount:0,queue:Promise.resolve()})
 useEffect(()=>{setWarning(null);guard.current.armed.clear();guard.current.away=false},[session?.meeting?.epoch])
 const enabled=Boolean(session?.meeting?.enabled && entered && session.status === 'active')
 const currentWarning=warning || (enabled&&session.meeting?.warning ? {type:session.meeting.warning,text:messages[session.meeting.warning]} : null)
 useEffect(()=>{if(enabled&&session.meeting.warning&&!warning){setWarning({type:session.meeting.warning,text:messages[session.meeting.warning]});announce(session.meeting.warning)}},[enabled,session?.meeting?.warning])
 useEffect(()=>()=>{guard.current.alive=false;guard.current.voiceSequence++;guard.current.audio?.pause();if(guard.current.url)URL.revokeObjectURL(guard.current.url)},[])
 function announce(key){
  const sequence=++guard.current.voiceSequence
  guard.current.audio?.pause();if(guard.current.url){URL.revokeObjectURL(guard.current.url);guard.current.url=null}
  setTimeout(async()=>{
   if(!guard.current.alive||sequence!==guard.current.voiceSequence)return
   const current=live.current
   if(current.config.voice==='browser') { window.speechSynthesis?.cancel();const utterance=new SpeechSynthesisUtterance(meetingMessages(current.session.language)[key]);utterance.lang=current.session.language==='hu'?'hu-HU':'en-US';window.speechSynthesis?.speak(utterance);return }
   try{
    const response=await fetch('/api/sessions/'+current.session.id+'/meeting/voice',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:key})})
    if(!response.ok)throw Error('Reminder audio unavailable')
    const blob=await response.blob();if(!guard.current.alive||sequence!==guard.current.voiceSequence)return
    const url=URL.createObjectURL(blob);guard.current.url=url;const audio=new Audio(url);guard.current.audio=audio;await audio.play()
   }catch{ /* The visible warning is always available if reminder audio is blocked. */ }
  },75)
 }
 function speakerMismatch(details){
  if(!enabled||currentWarning)return
  setWarning({type:'speaker-mismatch',text:messages['speaker-mismatch']});announce('speaker-mismatch');event('speaker-mismatch',details)
 }
 function event(type,details={}){
  const current=live.current;const questionId=current.session?.question?.id
  guard.current.queue=guard.current.queue.catch(()=>{}).then(async()=>{
   const data=await api('/sessions/'+current.session.id+'/meeting/event',{method:'POST',body:{type,eventId:crypto.randomUUID(),questionId,...details}})
   if(!guard.current.alive)return
   live.current.onUpdate(data)
   if(data.status==='held'){setWarning({type:'held',text:messages.held});announce(data.meeting?.hold?.reason==='Possible phone detected in camera'?'phone-visible':data.meeting?.hold?.reason==='Repeated audio without visible mouth movement'?'speaker-held':'held')}
   return data
  }).catch(e=>{if(guard.current.alive)setError(e.message)})
  return guard.current.queue
 }
 useEffect(()=>{
  if(!enabled)return
  const visibility=()=>{
   if(document.hidden&&!guard.current.away){guard.current.away=true;setWarning({type:'tab-warning',text:messages['tab-warning']});announce('tab-warning');event('tab-away')}
   else if(!document.hidden&&guard.current.away){guard.current.away=false;event('tab-return')}
  }
  document.addEventListener('visibilitychange',visibility)
  const timer=setInterval(()=>{setClock(Date.now());const data=live.current.session;if(data?.meeting?.tabDeadline && Date.now()>=Date.parse(data.meeting.tabDeadline))api('/sessions/'+data.id).then(live.current.onUpdate).catch(()=>{})},200)
  return()=>{document.removeEventListener('visibilitychange',visibility);clearInterval(timer)}
 },[enabled,session?.id])
 useEffect(()=>{
  if(!enabled||session.status!=='active'||session.meeting.cameraUnavailable)return
  if(observations.phone===true&&observations.phoneReady!==false&&!guard.current.armed.has('phone-visible')){
   guard.current.armed.add('phone-visible');setWarning({type:'phone-visible',text:messages['phone-visible']});event('phone-visible');return
  }
  if(session.meeting.warning)return
  const values={'face-missing':observations.missingSeconds>=3,'head-turned':observations.turnedSeconds>=3,'hands-out-of-frame':observations.handsConfirmed&&observations.handSeconds>=3}
  for(const [type,on] of Object.entries(values)){
   if(!on&&!warning)guard.current.armed.delete(type)
   if(on&&!warning&&!guard.current.armed.has(type)){guard.current.armed.add(type);const message=type==='head-turned'&&observations.direction==='down'?'head-down':type;setWarning({type:message,text:messages[message]});announce(message);event(type,type==='head-turned'?{direction:observations.direction}:{});break}
  }
 },[enabled,session?.status,observations.missingSeconds,observations.turnedSeconds,observations.handSeconds,observations.phoneSeconds,observations.phone,observations.phoneReady,observations.direction,session?.meeting?.warning,warning])
 useEffect(()=>{if(!enabled||session.meeting.identityOverride||session.meeting.cameraUnavailable||currentWarning)return;guard.current.identityCount=identity?.status==='review-required'?guard.current.identityCount+1:0;if(guard.current.identityCount>=3){guard.current.identityCount=0;setWarning({type:'identity-review',text:messages['identity-review']});event('identity-review')}},[enabled,identity?.sampleId,session?.meeting?.identityOverride])
 const corrected=['unavailable','off'].includes(observations.status) ? true : currentWarning?.type==='phone-visible' ? observations.phone === false || observations.phoneReady === false : currentWarning?.type==='speaker-mismatch'?observations.face===true&&observations.mouthReady===true:currentWarning?.type==='face-missing'?observations.face===true:['head-turned','head-down'].includes(currentWarning?.type)?observations.calibrated&&!observations.direction:currentWarning?.type==='hands-out-of-frame'?observations.hands>0:!document.hidden
 async function resume(){setError('');try{const data=await event('warning-resume');if(data?.status==='active'){setWarning(null);guard.current.voiceSequence++;guard.current.audio?.pause()}}catch(e){setError(e.message)}}
 return {speakerMismatch,warning:currentWarning,error,paused:Boolean(currentWarning),corrected,resume,announce,grace:session?.meeting?.tabDeadline?Math.max(0,Math.ceil((Date.parse(session.meeting.tabDeadline)-clock)/1000)):null}
}

export function MeetingWarning({rules}) {
 if(!rules.warning||rules.warning.type==='held')return null
 return <div className="meeting-warning-overlay" role="alertdialog" aria-modal="true" aria-label="Interviewer reminder"><div className="meeting-warning-card"><Icon name="shield" size={24}/><strong>Adnane · interviewer reminder</strong><p>{rules.warning.text}</p>{rules.grace!==null&&<b>{rules.grace}s to return</b>}<small>Camera geometry is a framing signal, not a finding of cheating. Repeated warnings place the meeting on hold for human review.</small><ErrorNotice message={rules.error}/>{rules.warning.type!=='phone-visible'&&<Button onClick={rules.resume} disabled={!rules.corrected||rules.grace!==null}>Continue meeting</Button>}</div></div>
}

export function MeetingHeld({session}) {
 return <section className="page narrow meeting-held"><span className="eyebrow">TEACHER REVIEW REQUIRED</span><h1>Meeting stopped for review.</h1><p>{session.meeting?.hold?.reason}</p><p>Your saved answers and current response draft are preserved. This is not an automatic disqualification.</p><a className="button button-primary" href={'#/teacher/meeting/'+session.id}>Open teacher review in this demo</a><a className="text-button" href="#/">Back home</a></section>
}

export function MeetingReview({sessionId}) {
 const resource=useResource('/sessions/'+sessionId+'/meeting/review'),[notes,setNotes]=useState(''),[reviewed,setReviewed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('')
 if(resource.error)return <ErrorNotice message={resource.error}/>
 if(!resource.data)return <Loading/>
 const {session,meeting,answers,identity}=resource.data
 async function decide(decision){setBusy(true);setError('');try{const result=await api('/sessions/'+sessionId+'/meeting/review',{method:'POST',body:{decision,reviewed,notes}});if(result.reportId)navigate('/teacher/report/'+result.reportId);else resource.reload()}catch(e){setError(e.message);resource.reload()}finally{setBusy(false)}}
 return <div className="page narrow"><a href="#/teacher" className="back-link">Teacher workspace</a><h1>Review this meeting</h1><div className="panel"><h2>{session.student}</h2><p>{meeting.hold?.reason||'The meeting is open again.'}</p><p><strong>Identity:</strong> {identity}. Compare an ID with the student yourself; this demo does not classify identity from camera frames.</p><p>Head direction and missing detections do not establish cheating. Check framing, technical problems and the student’s explanation before deciding.</p>{answers.map(answer=><div className="meeting-review-answer" key={answer.position}><strong>Question {answer.position}</strong><p>{answer.question}</p><p>{answer.transcript||'No answer supplied.'}</p></div>)}{meeting.draft?.text&&<div className="meeting-review-answer"><strong>Current response draft · not assessed</strong><p>{meeting.draft.text}</p></div>}<label>Review explanation · visible to the student<textarea value={notes} onChange={e=>setNotes(e.target.value)} maxLength={1000} rows={3}/></label><label className="checkbox-label"><input type="checkbox" checked={reviewed} onChange={e=>setReviewed(e.target.checked)}/>I reviewed the circumstances and any identity concern with the student.</label><ErrorNotice message={error}/>{session.status==='held'?<div className="inline-actions"><Button onClick={()=>decide('resume')} disabled={!reviewed||!notes.trim()} loading={busy}>Allow meeting to resume</Button><Button variant="white" onClick={()=>decide('end')} disabled={!reviewed||!notes.trim()} loading={busy}>Close attempt & create partial report</Button></div>:<p className="success-notice">{session.status==='completed'?'Attempt closed. The saved responses and draft remain available for review.':session.status==='active'?'Meeting reopened. The student can rejoin using the original link.':'Partial report pending. Return to the teacher workspace to retry report generation.'}</p>}</div></div>
}

export function MeetingQuestionView({session,avatar,voice,camera,observations,remaining,busy,error,typing,answer,revealed,onType,onText,onSubmit,onExpire,onReveal,onSkip,onLeave,onVoiceOnly,onListen,paused}) {
 return <section className="meeting-room" aria-label="Live interview meeting"><div className="meeting-topbar"><span><i className="meeting-live-dot"/>Merit Lens · live interview</span><strong>{session.challengeMode==='transfer'?<>Concept {session.question.pairIndex} / {session.pairCount} · {session.question.stage==='explain'?'1. Explain':'2. Apply'}</>:<>Question {session.questionNumber} / {session.maxQuestions}</>}</strong><span className="meeting-warning-counts"><span>Tab warnings {session.meeting?.tabCount||0} / 2</span><span>Camera warnings {cameraWarningCount(session.meeting)} / 2</span></span></div><div className="meeting-stage"><div className="meeting-teacher-tile"><Interviewer avatar={avatar} lipLevel={voice.lipLevel} lipPose={voice.lipPose} speaking={voice.speaking} loadingSpeech={voice.loadingSpeech} recording={voice.recording} transcribing={voice.transcribing} busy={busy}/><div className="meeting-name">Adnane <small>AI interviewer · synthetic voice</small></div></div><div className="meeting-student-tile"><CameraPreview camera={camera}/><div className="meeting-name">You <small>{camera.exception?'Camera exception':'Local camera'}</small></div><CameraObservations observations={observations} compact/></div></div><div className="meeting-question-bar"><div><small>{session.challengeMode==='transfer'?(session.question.stage==='explain'?'Explain · '+session.question.concept:'Apply · '+session.question.concept):'Your question'}</small>{session.challengeMode==='transfer'&&session.question.stage==='apply'&&<span className="transfer-answer-locked"><Icon name="check" size={12}/>Your first answer is saved</span>}{voice.speaking&&session.conversationLead&&<span className="meeting-conversation" role="status">{session.conversationLead}</span>}<p>{revealed||typing?session.question.text:voice.speaking?'Listen to the question.':voice.recording?'Your turn — explain your thinking.':'Ready when you are.'}</p></div><div className={'meeting-countdown '+(remaining<=3?'meeting-countdown-urgent':'')} aria-label={remaining+' seconds remaining'}><strong>{String(remaining).padStart(2,'0')}</strong><span>{voice.speaking?'Starts after question':voice.transcribing?'Transcribing':busy?'Saving response':'seconds to answer'}</span></div></div>{(typing||answer.trim())&&<div className="meeting-answer"><label>{typing?'Your answer':'Live transcript · editable before sending'}<textarea value={answer} onChange={e=>onText(e.target.value)} rows={2} maxLength={12000} disabled={busy||voice.recording}/></label><Button onClick={()=>onSubmit()} disabled={busy||voice.recording||voice.transcribing||!answer.trim()}>Send answer</Button></div>}<div className="meeting-controls"><button onClick={voice.recording?voice.stopRecording:voice.startRecording} disabled={paused||busy||voice.speaking||voice.transcribing||voice.requestingMicrophone}><Icon name={voice.recording?'stop':'mic'} size={19}/><span>{voice.recording?'Finish speaking':'Microphone'}</span></button><button onClick={onListen} disabled={paused||busy||voice.speaking||voice.recording||voice.transcribing}><Icon name="volume" size={19}/><span>Repeat question</span></button><button onClick={onReveal} disabled={busy}><Icon name="eye" size={19}/><span>Read question</span></button><button onClick={onType} disabled={busy||voice.recording||voice.transcribing}><Icon name="keyboard" size={19}/><span>{typing?'Use voice':'Type instead'}</span></button><button onClick={onVoiceOnly} disabled={busy||voice.recording}><Icon name="headphones" size={19}/><span>Voice only</span></button><button onClick={onSkip} disabled={paused||busy||voice.speaking||voice.recording||voice.transcribing}><Icon name="arrow" size={19}/><span>I don’t know</span></button><button onClick={onLeave} className="meeting-leave" disabled={busy}>Leave meeting</button></div><div className="meeting-caption" role="status">{voice.recording?'Your microphone is on. Speak now.':voice.transcribing?'Putting your answer into words…':busy?'Preparing the next question…':voice.loadingSpeech?'Preparing the audio…':voice.speaking?'Adnane is speaking.':paused?'Meeting paused.':'Automatic voice turns · your answer closes at the countdown.'}</div><ErrorNotice message={error||voice.error} onRetry={voice.error&&voice.retryTranscription&&!voice.transcribing?voice.retryTranscription:undefined}/></section>
}
