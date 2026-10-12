import {createSpeakerMismatchTracker} from '../shared/speaker-check.js'
import {PROJECT_DEMO_ID,projectSampleText} from '../shared/project-demo.js'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import {useInterviewPresence} from './lifecycle.js'
import { api, navigate, useResource } from './api.js'
import { Icon, Button, ErrorNotice, Loading, Badge, ListMore } from './components.jsx'
import { useReferenceFace, ReferenceFaceCheck } from './ReferenceFace.jsx'
import { meetingQuestionDuration } from '../shared/meeting-timer.js'
import { useMeetingRules, MeetingWarning, MeetingHeld, MeetingQuestionView } from './Meeting.jsx'
import { useVoice } from './voice.js'
import { UPLOAD_EXTENSIONS, UPLOAD_ACCEPT, UPLOAD_LABEL } from '../shared/uploads.js'
import { QUESTION_DURATION_SECONDS } from '../shared/timer.js'
import { InterviewTools, useInterviewSignals } from './Integrity.jsx'
import { useInterviewCamera, CameraSetup } from './Camera.jsx'
import Interviewer from './Interviewer.jsx'
import { useCameraObservations } from './CameraObservations.jsx'
import { useTalkingAvatar, AvatarSetup } from './avatar.jsx'
import { StudentFeedback } from './Assessment.jsx'

const sampleText=projectSampleText

export function StudentUpload({ assignmentId, config, language, challengeEntry = false, prefillSample=false }) {
  const assignments = useResource('/assignments')
  const [selected, setSelected] = useState(assignmentId || '')
  const [student, setStudent] = useState(prefillSample?'Adnane Essoufi':'')
  const [tab, setTab] = useState(prefillSample?'text':'file')
  const [text, setText] = useState(prefillSample?sampleText:'')
  const [file, setFile] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const input = useRef(null)
  const requestId = useRef(crypto.randomUUID())
  const availableAssignments=assignments.data?.filter(a=>!challengeEntry||a.challenge_mode==='transfer')||[]
  const currentId = selected || availableAssignments.find(a=>a.id===PROJECT_DEMO_ID&&a.status==='open')?.id || availableAssignments.find(a => a.status === 'open')?.id || ''
  const sampleAssignment=availableAssignments.find(a=>a.id===PROJECT_DEMO_ID&&a.status==='open')
  const assignment = assignments.data?.find(a => a.id === currentId)
  const challengeMode=assignment?.challenge_mode||'standard',pairCount=assignment?.concept_count||2
  function choose(file) {
    if (!file) return
    setError('')
    const extension = '.' + file.name.split('.').pop().toLowerCase()
    if (!UPLOAD_EXTENSIONS.includes(extension)) return setError('Choose a supported document, text/code file, CSV, or Jupyter notebook.')
    if (file.size > 10 * 1024 * 1024) return setError('Choose a file smaller than 10 MB.')
    setFile(file)
    requestId.current = crypto.randomUUID()
  }
  async function submit(event) {
    event.preventDefault()
    setError('')
    if (tab === 'file' && !file) return setError('Choose an assignment file first, or paste your text.')
    setBusy(true)
    try {
      const body = new FormData()
      body.append('assignmentId', currentId)
      body.append('student', student)
      body.append('language', language)
      body.append('requestId', requestId.current)
      if (tab === 'file') body.append('file', file)
      else body.append('text', text)
      const session = await api('/submissions', { method: 'POST', body })
      rememberSession(session); navigate(`/session/${session.id}`)
    } catch (error) { setError(error.message) } finally { setBusy(false) }
  }
  return <div className="page student-page">
    <div className="page-heading"><h1>{challengeEntry?'Start a live transfer challenge':'Upload your work'}</h1>{challengeEntry&&<p>Upload your work. Explain your choices, then apply them to a new situation.</p>}</div>
    <RecentSessions /><div className="upload-layout"><form className="panel upload-panel" onSubmit={submit}><div className="panel-heading"><span className="icon-tile"><Icon name="upload" /></span><div><h2>Your assignment</h2></div></div>
      <fieldset disabled={busy} className="upload-desktop-grid"><div className="upload-details"><div className="form-grid"><label>Your name<input value={student} onChange={e => { setStudent(e.target.value); requestId.current = crypto.randomUUID() }} placeholder="e.g. Alex Morgan" required maxLength={100} autoComplete="name" /></label><label>Assignment<select disabled={Boolean(assignmentId)} value={currentId} onChange={e => { setSelected(e.target.value); requestId.current = crypto.randomUUID() }} required>{availableAssignments.filter(a => a.status === 'open' || a.id === currentId).map(a => <option key={a.id} value={a.id}>{a.title}</option>)}</select></label></div>

      {assignment && <details className="assignment-context"><summary>Assignment details</summary><p>{assignment.brief}</p>{assignment.instructions_text&&assignment.instructions_text!==assignment.brief&&<pre className="teacher-source-preview">{assignment.instructions_text}</pre>}</details>}
      {assignment&&<div className="transfer-upload-controls"><span><strong>{challengeMode==='transfer'?'Understanding transfer':'Standard interview'}</strong><small>{challengeMode==='transfer'?pairCount+' concepts · Explain → Apply':'Up to 6 questions'}</small></span><span className="teacher-set-mode">Set by your teacher</span></div>}<div className="sample-row"><button type="button" className="text-button" disabled={!sampleAssignment} onClick={() => { setTab('text'); setText(sampleText); setSelected(sampleAssignment.id); setStudent(student || 'Adnane Essoufi'); requestId.current = crypto.randomUUID() }}>Use a sample assignment <Icon name="arrow" size={14} /></button></div>
      </div><div className="upload-work">
      <div className="segmented" aria-label="Submission method"><button type="button" className={tab === 'file' ? 'active' : ''} onClick={() => setTab('file')}><Icon name="upload" size={16} />Upload a file</button><button type="button" className={tab === 'text' ? 'active' : ''} onClick={() => setTab('text')}><Icon name="edit" size={16} />Paste text</button></div>
      {tab === 'file' ? <div className={`dropzone ${dragging ? 'dragging' : ''} ${file ? 'has-file' : ''}`} onDragOver={e => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); if (!busy) choose(e.dataTransfer.files[0]) }}><span className="upload-icon"><Icon name={file ? 'file' : 'upload'} size={29} /></span><strong>{file ? file.name : 'Upload your assignment'}</strong><p>{file ? `${(file.size / 1024).toFixed(0)} KB · Ready to upload` : 'Drag your assignment here, or choose a file.'}</p><Button type="button" variant="white" onClick={() => input.current.click()}>{file ? 'Change file' : 'Choose file'}</Button><small>{UPLOAD_LABEL} · Up to 10 MB</small><input ref={input} type="file" accept={UPLOAD_ACCEPT} className="visually-hidden" tabIndex={-1} onChange={e => choose(e.target.files[0])} /></div>
      : <label className="paste-label">Assignment text<textarea aria-label="Assignment text" value={text} onChange={e => { setText(e.target.value); requestId.current = crypto.randomUUID() }} placeholder="Paste the full text of your assignment here…" required minLength={40} maxLength={60000} rows={10} /><span className="field-help">{text.length.toLocaleString()} / 60,000 characters</span></label>}
      </div></fieldset>
      <ErrorNotice message={error || assignments.error} onRetry={assignments.error ? assignments.reload : undefined} />
      {assignment?.status === 'closed' && <ErrorNotice message="This assignment is closed for new submissions. Contact your teacher." />}<div className="upload-actions"><Button type="submit" className="full" loading={busy} disabled={!assignment || assignment.status === 'closed'}>{busy ? 'Reading your work & preparing questions…' : 'Continue'}{!busy && <Icon name="arrow" size={18} />}</Button>
      <details className="data-details"><summary>Data & privacy</summary><p>{config.mode === 'demo' ? 'Demo mode uses local practice questions. Evidence labels are illustrative.' : 'Your assignment and responses are sent to OpenAI for analysis.'} {config.voice !== 'browser' ? `Questions use an AI-generated voice. Recordings are transcribed by ${config.voice === 'openai' ? 'OpenAI' : 'ElevenLabs'}.` : 'Voice uses your browser’s speech services where supported.'}</p></details>
    </div></form></div>
  </div>
}

export function Defence({ sessionId, config, language, onLanguage }) {
  const resource = useResource(`/sessions/${sessionId}`)
  const [entered, setEntered] = useState(false)
  const signals = useInterviewSignals(sessionId, entered && resource.data?.status === 'active')
  const camera = useInterviewCamera(sessionId, signals.record)
  const [languageError, setLanguageError] = useState('')
  const previousLanguage = useRef(language)
  const languageLoaded = useRef(false)
  const session = resource.data
  useInterviewPresence(session)
  const avatar = useTalkingAvatar(session, config)
  const [phase, setPhase] = useState('question')
  const onPhase = useCallback(value => setPhase(value), [])
  const observations = useCameraObservations({ camera, sessionId, questionId: session?.question?.id, phase, meetingMode: Boolean(session?.meeting?.enabled), inhibited: Boolean(session?.meeting?.warning), entered: entered && session?.status === 'active', record: signals.record })
  const meetingMode=true,answerSeconds=session?.meetingQuestionSeconds||meetingQuestionDuration(session?.question)
  const identity=useReferenceFace(camera)
  const [autoVoice,setAutoVoice]=useState(true),[joining,setJoining] = useState(false),[joinError,setJoinError] = useState('')
  const previousEpoch = useRef(null)
  const rules = useMeetingRules({session,entered,config,observations,identity,onUpdate:resource.setData})
  useEffect(()=>{if(session?.meeting?.autoVoice!==undefined)setAutoVoice(session.meeting.autoVoice)},[session?.id])
  const faceReady=camera.ready&&observations.face===true&&observations.calibrated===true
  const identityReady=identity.status==='matched'||session?.meeting?.identityOverride===true
  const canJoin=camera.exception||(faceReady&&identityReady)||session?.meeting?.cameraExceptionApproved===true
  async function requestIdentityReview(){setJoining(true);try{resource.setData(await api('/sessions/'+sessionId+'/meeting/identity-review',{method:'POST',body:{cameraUnavailable:camera.exception===true}}))}catch(e){setJoinError(e.message)}finally{setJoining(false)}}
  useEffect(()=>{if(session?.status==='held'){camera.release();const timer=setInterval(()=>resource.reload(),2000);return()=>clearInterval(timer)}},[session?.status])
  useEffect(()=>{const epoch=session?.meeting?.epoch;if(epoch===undefined)return;if(previousEpoch.current!==null&&previousEpoch.current!==epoch)setEntered(false);previousEpoch.current=epoch},[session?.meeting?.epoch])
  async function join(){if(!canJoin){setJoinError('Keep your face visible and finish the reference check before joining.');return}setJoining(true);setJoinError('');try{if(meetingMode&&autoVoice){if(config.voice==='browser'&&!(window.SpeechRecognition||window.webkitSpeechRecognition))throw Error('Dictation is unavailable here. Use the small microphone-unavailable option to continue with typing.');const stream=await navigator.mediaDevices.getUserMedia({audio:true});stream.getTracks().forEach(t=>t.stop())}const data=await api('/sessions/'+sessionId+'/meeting',{method:'POST',body:{autoVoice,faceVisible:faceReady,cameraUnavailable:camera.exception,identityStatus:camera.exception?'not-checked':identity.status}});resource.setData(data);if(meetingMode&&config.voice!=='browser')fetch('/api/sessions/'+sessionId+'/meeting/voice',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'tab-warning'})}).catch(()=>{});setEntered(true)}catch(e){setJoinError(e.name==='NotAllowedError'?'Microphone permission denied. Use the microphone-unavailable option to continue with typing.':e.message)}finally{setJoining(false)}}
  useEffect(() => { if (session && !['active','held'].includes(session.status)) navigate(`/complete/${session.id}`) }, [session])
  async function changeLanguage() {
    setLanguageError('')
    try { resource.setData(await api('/sessions/' + sessionId + '/language', { method: 'POST', body: { language } })) }
    catch(e) { setLanguageError(e.message) }
  }
  useEffect(() => {
    if (!session || session.status !== 'active') return
    if (!languageLoaded.current) {
      rememberSession(session); languageLoaded.current = true; previousLanguage.current = session.language; onLanguage?.(session.language); return
    }
    if (previousLanguage.current !== language) {
      previousLanguage.current = language
      if (session.language !== language) changeLanguage()
    }
  }, [session?.id, language, sessionId])
  if (resource.error) return <div className="page narrow"><ErrorNotice message={resource.error} onRetry={resource.reload} /></div>
  if (!session) return <Loading />
  if (!['active','held'].includes(session.status)) return <Loading label="Preparing your completion…" />
  if (!entered && session.status !== 'held') return <section className={'ready-page camera-ready-page meeting-ready compact-preflight'+(camera.exception?' preflight-no-camera':'')}><header className="preflight-heading"><div><h1>Join your interview</h1><span className="preflight-file">{session.filename}</span></div><div className="ready-interviewer"><img src="/assets/adnane-interviewer.jpg" alt="Adnane, AI interviewer"/><span><strong>Adnane</strong><small>AI interviewer</small></span></div></header><div className="preflight-grid"><div className="preflight-camera"><AvatarSetup avatar={avatar}/><CameraSetup camera={camera} observations={observations}/>{!camera.exception&&<ReferenceFaceCheck identity={identity} approved={session.meeting?.identityOverride} onReview={requestIdentityReview}/>}</div><div className="panel preflight-actions"><h2>Interview setup</h2><div className="preflight-facts"><span>{session.challengeMode==='transfer'?session.pairCount+' concepts · '+session.maxQuestions+' questions':'Standard oral defence'}</span><span>{answerSeconds}s for the first answer</span><span>{camera.exception?'Camera off · identity not checked':canJoin?'Camera check complete':'Complete the camera check'}</span></div><details><summary>Meeting rules</summary><p>Return within 7 seconds if you leave this tab. Repeated warnings pause the meeting for review.</p></details><details><summary>Microphone unavailable?</summary><button className="text-button" onClick={()=>setAutoVoice(false)}>Use typing for this demo</button></details><ErrorNotice message={joinError}/><Button onClick={join} loading={joining} disabled={!canJoin}>Join meeting<Icon name="arrow" size={17}/></Button></div></div></section>
  return <><ErrorNotice message={languageError} onRetry={changeLanguage} /><InterviewRoom session={session} config={config} onUpdate={resource.setData} avatar={avatar} signals={signals} camera={camera} observations={observations} onPhase={onPhase} rules={rules} /><MeetingWarning rules={rules}/></>
}

function InterviewRoom({ session, config, onUpdate, avatar, signals, camera, observations, onPhase, rules }) {
  const meeting = session.meeting?.enabled
  const paused = !camera.canProceed || (meeting && rules.paused) || session.status === 'held'
  return <><div className={meeting ? "meeting-layout" : "interview-layout"} inert={paused ? true : undefined}><Question key={session.question.id + '-' + session.language + '-' + (session.meeting?.epoch||0)} session={session} config={config} onUpdate={onUpdate} avatar={avatar} paused={paused} onPhase={onPhase} camera={camera} observations={observations} rules={rules} />{!meeting&&<InterviewTools signals={signals} camera={camera} observations={observations} />}</div>{session.status==='held'&&<div className="meeting-hold-overlay"><MeetingHeld session={session}/></div>}{!camera.canProceed && session.status==='active' && !rules.warning && <div className="camera-pause-overlay" role="dialog" aria-modal="true" aria-labelledby="camera-pause-title"><div className="panel"><h2 id="camera-pause-title">Reconnect your camera to continue</h2><p>Your answers and current question are still here.</p><CameraSetup camera={camera} /></div></div>}</>
}

function Question({ session, config, onUpdate, avatar, paused, onPhase, camera, observations, rules }) {
  const meeting = session.meeting?.enabled
  const [revealed, setRevealed] = useState(false)
  const [typing, setTyping] = useState(() => Boolean(sessionStorage.getItem(`merit-lens-draft:${session.id}:${session.question.id}`)))
  const draftKey = `merit-lens-draft:${session.id}:${session.question.id}`
  const [answer, setAnswer] = useState(() => sessionStorage.getItem(draftKey) || '')
  const answerRef=useRef(answer)
  answerRef.current=answer
  const [finalFeedback,setFinalFeedback]=useState('')
  const [timedOut,setTimedOut]=useState(false)
  const timeoutHandled=useRef(false),autoRecording=useRef(false),recordingPrefix=useRef('')
  const [method, setMethod] = useState(() => sessionStorage.getItem(`merit-lens-draft-method:${session.id}:${session.question.id}`) || 'voice')
  function saveDraft(value, responseMethod = method) {
    sessionStorage.setItem(draftKey, value); sessionStorage.setItem(`merit-lens-draft-method:${session.id}:${session.question.id}`, responseMethod); answerRef.current=value;setAnswer(value); setMethod(responseMethod);if(meeting)api('/sessions/'+session.id+'/meeting/draft',{method:'POST',body:{questionId:session.question.id,text:value}}).catch(()=>{})
  }
  const [startedAt, setStartedAt] = useState(session.questionStartedAt)
  const [endedAt, setEndedAt] = useState(session.responseEndedAt)
  const [time, setTime] = useState(Date.now())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirmSkip, setConfirmSkip] = useState(false)
  const started = useRef(session.questionStartedAt)
  const presentPromise = useRef(null)
  const mounted = useRef(true)
  const path = `/sessions/${session.id}`
  const questionId = session.question.id
  useEffect(() => () => { mounted.current = false }, [])
  async function present() {
    if (started.current) return
    if (!presentPromise.current) presentPromise.current = api(`${path}/present`, { method: 'POST', body: { questionId } }).then(data => {
      started.current = data.questionStartedAt
      if (mounted.current) setStartedAt(data.questionStartedAt)
    }).finally(() => { presentPromise.current = null })
    await presentPromise.current
  }
  async function markEnded() {
    const data = await api(`${path}/response-ended`, { method: 'POST', body: { questionId } })
    if (mounted.current) setEndedAt(data.responseEndedAt)
  }
  async function resumeResponse() {
    await api(`${path}/response-resume`, { method: 'POST', body: { questionId } })
    if (mounted.current) setEndedAt(null)
  }
  const wasPaused=useRef(paused)
  const autoPlayed = useRef(false)
  useEffect(()=>{if(wasPaused.current&&!paused&&!startedAt)autoPlayed.current=false;wasPaused.current=paused},[paused,startedAt])
  const voice = useVoice({ session, config, avatar, onPresented: present, onEnded: markEnded, onResume: resumeResponse, onNoSpeech:()=>{timeoutHandled.current=true;setTimedOut(true)},
    onTranscript: text => saveDraft(meeting && recordingPrefix.current.trim() ? recordingPrefix.current.trim()+' '+text : text, 'voice') })
  const speakerTracker=useRef(null),speakerWarned=useRef(false),speakerState=useRef(null)
  if(!speakerTracker.current)speakerTracker.current=createSpeakerMismatchTracker()
  speakerState.current={enabled:Boolean(meeting&&voice.recording&&!typing&&!paused&&!busy&&!voice.speaking&&!voice.loadingSpeech&&!voice.transcribing&&!camera.exception&&!session.meeting.cameraUnavailable&&observations.status==='ready'&&!observations.direction),level:voice.level,mouthReady:observations.mouthReady,mouthMoving:observations.mouthMoving,face:observations.face,frameAt:observations.mouthSampleAt}
  useEffect(()=>{
    const interval=setInterval(()=>{
      const state=speakerState.current
      if(!state.enabled){speakerTracker.current.reset();speakerWarned.current=false;return}
      const observed=speakerTracker.current.sample(state,performance.now())
      if(observed.flag&&!speakerWarned.current){speakerWarned.current=true;rules.speakerMismatch({durationSeconds:Math.floor(observed.seconds)})}
    },100)
    return()=>clearInterval(interval)
  },[questionId])
  function beginRecording(){recordingPrefix.current=answerRef.current;voice.startRecording()}
  useEffect(() => { onPhase(!paused && startedAt && !busy && !voice.speaking && !voice.transcribing && !endedAt ? (typing ? 'typing' : 'answer') : 'question'); return () => onPhase('question') }, [paused, startedAt, busy, voice.speaking, voice.transcribing, endedAt, typing, onPhase])
  useEffect(() => { if (paused) { voice.stopSpeaking(); voice.stopRecording({interrupted:true}) } }, [paused])
  useEffect(() => {
    if (!paused && !autoPlayed.current && (avatar.voiceOnly || ['disabled', 'ready', 'error'].includes(avatar.status))) {
      autoPlayed.current = true
      // A failed avatar needs an explicit choice; do not silently pretend the portrait talks.
      if (avatar.status !== 'error' || avatar.voiceOnly) voice.speak()
    }
  }, [paused, avatar.status, avatar.voiceOnly])
  useEffect(() => {
    if (!startedAt || endedAt) return
    const interval = setInterval(() => setTime(Date.now()), 250)
    return () => clearInterval(interval)
  }, [startedAt, endedAt])
  const remaining = startedAt ? Math.min(session.duration, Math.max(0, session.duration - Math.floor(((endedAt ? Date.parse(endedAt) : time) - Date.parse(startedAt)) / 1000))) : session.duration
  useEffect(()=>{if(meeting && session.questionStartedAt){started.current=session.questionStartedAt;setStartedAt(session.questionStartedAt);setEndedAt(session.responseEndedAt)}},[session.questionStartedAt,session.responseEndedAt,meeting])
  useEffect(()=>{if(meeting && session.meeting.autoVoice && startedAt && !paused && !voice.speaking && !voice.transcribing && !voice.recording && !busy && !typing && !timedOut && !autoRecording.current){autoRecording.current=true;beginRecording()}if(paused)autoRecording.current=false},[meeting,startedAt,paused,voice.speaking,voice.transcribing,voice.recording,busy,typing,timedOut])
  useEffect(()=>{if(!meeting||!startedAt||paused||busy||voice.speaking||timedOut||remaining>0)return;timeoutHandled.current=true;setTimedOut(true);voice.stopRecording();api(path+'/meeting/event',{method:'POST',body:{eventId:crypto.randomUUID(),type:'timeout',questionId}}).catch(()=>{})},[meeting,startedAt,paused,busy,voice.speaking,remaining,timedOut])
  useEffect(()=>{if(timedOut&&!paused&&!busy&&!voice.error&&!voice.recording&&!voice.requestingMicrophone&&!voice.transcribing&&timeoutHandled.current){timeoutHandled.current=false;submit(!answerRef.current.trim())}},[timedOut,paused,busy,voice.recording,voice.requestingMicrophone,voice.transcribing,voice.error,answer])
  useEffect(()=>{if(meeting&&endedAt&&!paused&&!busy&&!voice.recording&&!voice.transcribing&&!voice.error&&answerRef.current.trim()&&!timedOut){timeoutHandled.current=true;setTimedOut(true)}},[meeting,endedAt,paused,busy,voice.recording,voice.transcribing,voice.error,timedOut,answer])
  async function reveal() {
    autoPlayed.current = true
    voice.stopSpeaking()
    setRevealed(true)
    try { await present() } catch (error) { setError(error.message) }
  }
  async function submit(skip = false) {
    setBusy(true); setError('')
    try {
      await present()
      const data = await api(`${path}/answers`, { method: 'POST', body: { questionId, transcript: skip ? '' : answerRef.current, method: skip ? 'skipped' : method, skip } })
      sessionStorage.removeItem(draftKey); sessionStorage.removeItem(`merit-lens-draft-method:${session.id}:${session.question.id}`)
      if(!data.question&&data.lastAnswerFeedback){setFinalFeedback(data.lastAnswerFeedback);await voice.speakFeedback(data.lastAnswerFeedback)}
      onUpdate(data)
    } catch (error) { setError(error.message) } finally { if (mounted.current) setBusy(false) }
  }
  async function skipDefence() {
    setBusy(true); setError('')
    voice.stopSpeaking()
    try { const data = await api(`${path}/${meeting?'leave':'skip-defence'}`, { method: 'POST',body:meeting?{questionId,draftText:answerRef.current}:undefined }); sessionStorage.removeItem(draftKey); onUpdate(data) }
    catch (error) { setError(error.message); setConfirmSkip(false) }
    finally { if (mounted.current) setBusy(false) }
  }
  if(meeting)return <MeetingQuestionView session={finalFeedback?{...session,conversationLead:finalFeedback,question:{...session.question,text:finalFeedback}}:session} avatar={avatar} voice={{...voice,startRecording:beginRecording}} camera={camera} observations={observations} remaining={remaining} busy={busy} error={error} typing={typing} revealed={revealed} answer={answer} paused={paused} onText={value=>saveDraft(value,'text')} onType={()=>{setTyping(!typing);autoRecording.current=false;if(!typing)setMethod('text')}} onSubmit={()=>submit()} onSkip={()=>submit(true)} onReveal={reveal} onLeave={skipDefence} onVoiceOnly={()=>{autoPlayed.current=true;avatar.continueWithVoice();voice.speak({audioOnly:true})}} onListen={()=>voice.speak()} />
  return <section className="defence-page"><div className="defence-context">{session.assignmentTitle}</div><div className="defence-progress" aria-label={`${session.answered} questions answered, maximum ${session.maxQuestions}`}>{Array.from({ length: session.maxQuestions }, (_, i) => <span className={i < session.answered ? 'done' : i === session.answered ? 'current' : ''} key={i} />)}</div><p className="question-counter">Question {session.questionNumber} <span>{session.challengeMode === 'transfer' ? 'of ' + session.maxQuestions : 'of up to '+session.maxQuestions}</span></p>{session.challengeMode === 'transfer' && <div className="transfer-stage"><span>Concept {session.question.pairIndex} of {session.pairCount} · {session.question.concept}</span><strong>{session.question.stage === 'explain' ? '1 · Explain the original choice' : '2 · Apply the idea under a change'}</strong><small>{session.question.stage === 'explain' ? 'Your explanation is saved before the changed situation is introduced.' : 'State what changes, what you would do, and why the same principle applies.'}</small></div>}
    <Interviewer avatar={avatar} videoRef={voice.videoRef} videoActive={voice.videoActive} lipLevel={voice.lipLevel} lipPose={voice.lipPose} speaking={voice.speaking} loadingSpeech={voice.loadingSpeech} recording={voice.recording} transcribing={voice.transcribing} busy={busy} />
    {avatar.renderer !== 'local-mouth' && config.avatarConfigured && !avatar.voiceOnly && avatar.status !== 'ready' && <div className="avatar-progress" role="status"><span>{avatar.status === 'error' ? avatar.error : 'Preparing the talking question…'}</span><button onClick={() => { autoPlayed.current = true; avatar.continueWithVoice(); voice.speak({ audioOnly: true }) }} disabled={paused || busy || voice.recording || voice.requestingMicrophone || voice.transcribing}>Continue with voice only</button>{avatar.status === 'error' && !/D-ID credits are exhausted/i.test(avatar.error || '') && <button onClick={() => { autoPlayed.current = false; avatar.retry() }}>Retry avatar</button>}</div>}
    {config.avatarConfigured && !avatar.voiceOnly && avatar.status === 'ready' && <div className="avatar-progress"><button onClick={() => { autoPlayed.current = true; voice.stopSpeaking(); avatar.continueWithVoice(); voice.speak({ audioOnly: true }) }} disabled={paused || busy || voice.recording || voice.requestingMicrophone || voice.transcribing}>Use voice only</button></div>}
    {voice.recording && config.voice !== 'browser' && <div className="microphone-level" aria-label="Microphone activity"><span style={{ width: Math.max(3, voice.level * 100) + '%' }} /></div>}<div className="question-controls"><Button variant="ghost" onClick={() => voice.speak()} disabled={(config.avatarConfigured && !avatar.voiceOnly && avatar.status !== 'ready') || voice.speaking || voice.recording || voice.requestingMicrophone || voice.transcribing || busy}><Icon name="volume" size={17} />Listen Again</Button><Button variant="ghost" onClick={reveal} disabled={busy} aria-expanded={revealed}><Icon name="eye" size={17} />{revealed ? 'Question visible' : 'See Question'}</Button></div>
    {finalFeedback?<p role="status">{finalFeedback}</p>:revealed && <div className="revealed-question">{session.question.text}</div>}
    <div className="timing-guide"><div className={`timer ${remaining === 0 ? 'timer-expired' : ''}`} aria-label={`${remaining} seconds remaining`}><Icon name="clock" size={17} /><span>{String(Math.floor(remaining / 60)).padStart(2, '0')}:{String(remaining % 60).padStart(2, '0')}</span></div><span className="timing-label">{session.timingMode === 'adaptive' ? 'Adaptive guide · ' + session.duration + 's' : 'Response guide'}</span><button type="button" className="text-button" disabled={busy || voice.recording || voice.transcribing || Boolean(endedAt) || session.duration >= 300} onClick={async () => { setBusy(true); setError(''); try { onUpdate(await api(`${path}/more-time`, { method: 'POST', body: { questionId } })) } catch (error) { setError(error.message) } finally { setBusy(false) } }}>+15 seconds</button></div>
    {remaining === 0 && <p className="timer-note" role="status">The timer has ended. You can still finish your answer.</p>}
    {!typing && <><button className={`answer-mic ${voice.recording ? 'recording' : ''}`} onClick={voice.recording ? voice.stopRecording : voice.startRecording} disabled={!startedAt || voice.speaking || voice.requestingMicrophone || voice.transcribing || busy} aria-label={voice.recording ? 'Stop recording' : 'Record answer'}><Icon name={voice.recording ? 'stop' : 'mic'} size={32} /></button><span className="mic-label">{voice.requestingMicrophone ? 'Getting your microphone ready…' : voice.recording ? 'Finish recording' : answer ? 'Record again' : 'Answer'}</span></>}
    <button className="type-fallback" disabled={voice.recording || voice.requestingMicrophone || voice.transcribing || busy} onClick={() => { setTyping(!typing); if (!typing) setMethod('text') }}><Icon name={typing ? 'mic' : 'keyboard'} size={16} />{typing ? 'Use my voice instead' : 'Can’t speak? Type your answer'}</button>
    {(typing || answer.trim()) && <div className="response-box"><label>{typing ? 'Your answer' : 'Your transcript · review before sending'}<textarea aria-label={typing ? 'Your answer' : 'Your transcript · review before sending'} autoFocus={typing} value={answer} onChange={e => saveDraft(e.target.value, typing ? 'text' : method)} placeholder="Explain your thinking in your own words…" maxLength={12000} rows={4} disabled={busy || voice.recording} /></label><Button onClick={() => submit()} loading={busy} disabled={!startedAt || !answer.trim() || voice.recording || voice.requestingMicrophone || voice.transcribing || voice.speaking}>Send answer <Icon name="arrow" size={17} /></Button></div>}
    <ErrorNotice message={error || voice.error} onRetry={voice.error && voice.retryTranscription && !voice.transcribing ? voice.retryTranscription : undefined} />
    <button className="skip-button" onClick={() => submit(true)} disabled={!startedAt || busy || voice.recording || voice.requestingMicrophone || voice.speaking || voice.transcribing}>I’m not sure · skip this question</button><button className="skip-button skip-defence-button" onClick={() => setConfirmSkip(true)} disabled={busy || voice.recording || voice.requestingMicrophone || voice.transcribing}>Skip Defence</button>{confirmSkip && <div className="skip-confirm" role="dialog" aria-modal="true" aria-labelledby="skip-title"><div className="panel"><h2 id="skip-title">Skip Defence</h2><p>Skip the entire oral defence? Your teacher will see that you skipped it.</p><div className="inline-actions"><Button variant="white" onClick={() => setConfirmSkip(false)} disabled={busy}>Cancel</Button><Button onClick={skipDefence} loading={busy}>Yes, skip defence</Button></div></div></div>}<div className="defence-bottom"><Icon name="shield" size={14} /><span>Your teacher reviews the evidence. This is a conversation, not a verdict.</span></div>
  </section>
}

export function Completion({ sessionId }) {
  const resource = useResource(`/sessions/${sessionId}`)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const session = resource.data
  async function retry() {
    setBusy(true); setError('')
    try { resource.setData(await api(`/sessions/${sessionId}/report`, { method: 'POST' })) }
    catch (error) { setError(error.message) } finally { setBusy(false) }
  }
  if (resource.error) return <div className="page narrow"><ErrorNotice message={resource.error} onRetry={resource.reload} /></div>
  if (!session) return <Loading />
  if (session.status === 'held') return <MeetingHeld session={session}/>
  if (session.status === 'active') return <div className="ready-page narrow"><h1>Your conversation is still open.</h1><a className="button button-primary" href={`#/session/${sessionId}`}>Resume oral defence <Icon name="arrow" /></a></div>
  const completed = session.status === 'completed'
  const ended=Boolean(session.meeting?.endedForDeparture)
  return <section className="page completion-page">
   <header className="completion-heading"><div className={'completion-seal'+(ended?' completion-ended':'')}><Icon name={ended?'clock':'check'} size={25}/></div><div><h1>{ended?'Interview ended':session.defenceSkipped?'Oral defence skipped':'Interview complete'}</h1><p>{ended?'Your answers are saved. This interview ended early.':session.defenceSkipped?'Your teacher will see that you skipped the oral defence.':'Your responses have been submitted to your teacher for review.'}</p></div></header>
   <div className="completion-grid"><div className="panel completion-summary"><span className="icon-tile"><Icon name="file"/></span><div><strong>{session.assignmentTitle}</strong><small>{session.answered} responses saved · {session.student}</small></div><Badge status={completed?'completed':'pending'}>{completed?'Submitted':'Report pending'}</Badge></div>
   {!completed?<div className="panel report-pending"><h2>Report pending</h2><p>Your answers are safely stored. The report could not be finished yet.</p><ErrorNotice message={error}/><Button onClick={retry} loading={busy}>Retry report generation</Button></div>:<StudentFeedback sessionId={sessionId}/>}</div>
   {session.lastAnswerFeedback&&<p role="status">{session.lastAnswerFeedback}</p>}
   <div className="completion-actions"><a className="button button-primary" href="#/">Back to home<Icon name="arrow" size={18}/></a>{completed&&<a className="text-button demo-report-link" href={'#/teacher/report/'+session.reportId}>Open report in teacher demo<Icon name="arrow" size={15}/></a>}</div>
  </section>
}

function readRecent() {
  try { const entries = JSON.parse(localStorage.getItem('merit-lens-sessions') || '[]'); return Array.isArray(entries) ? entries.filter(s => s && typeof s.id === 'string' && typeof s.assignmentTitle === 'string').slice(0, 8) : [] } catch { return [] }
}
function rememberSession(session) {
  try { const entries = [{ id: session.id, assignmentTitle: session.assignmentTitle, student: session.student }, ...readRecent().filter(s => s.id !== session.id)].slice(0, 8); localStorage.setItem('merit-lens-sessions', JSON.stringify(entries)) } catch {}
}
function RecentSessions() {
  const [limit,setLimit]=useState(2)
  const recent = readRecent()
  if (!recent.length) return null
  return <details className="panel recent-sessions"><summary>Your recent submissions on this device</summary>{recent.slice(0,limit).map(s => <a key={s.id} className="recent-session" href={'#/session/' + s.id}><span><strong>{s.assignmentTitle}</strong><small>{s.student}</small></span><Icon name="arrow" size={17} /></a>)}<ListMore total={recent.length} limit={limit} step={2} onChange={setLimit} label="submissions"/></details>
}
