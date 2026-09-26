import React, { useEffect, useRef, useState } from 'react'
import { api, navigate, useResource } from './api.js'
import { Icon, Button, ErrorNotice, Loading, Wave, Badge } from './components.jsx'
import { useVoice } from './voice.js'

const sampleText = `My Python reading-list project

I built a Python application that lets a reader add books, find a book by its ISBN, and mark a book as finished.

Dictionaries
I stored each book in a dictionary using its ISBN as the key. This avoids scanning a whole list to find one book and prevents two entries with the same ISBN. A dictionary uses more memory than a simple list, which is a trade-off I accepted for faster lookups.

Search complexity
Dictionary lookup is O(1) on average, while scanning a list is O(n). A hash function maps the ISBN to a location. Collisions can make the worst case slower, so constant time is an average expectation rather than a guarantee.

Testing
I tested adding books, duplicate ISBNs, and looking up a missing book. I used dictionary.get so a missing ISBN returns None instead of raising a KeyError, then displayed a helpful message. I also checked an empty reading list and invalid input. These tests helped me find an error where a duplicate book overwrote the original entry.`

export function StudentUpload({ assignmentId, config }) {
  const assignments = useResource('/assignments')
  const [selected, setSelected] = useState(assignmentId || '')
  const [student, setStudent] = useState('')
  const [tab, setTab] = useState('file')
  const [text, setText] = useState('')
  const [file, setFile] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const input = useRef(null)
  const requestId = useRef(crypto.randomUUID())
  const currentId = selected || assignments.data?.[0]?.id || ''
  const assignment = assignments.data?.find(a => a.id === currentId)
  function choose(file) {
    if (!file) return
    setError('')
    if (!/\.(pdf|docx|txt)$/i.test(file.name)) return setError('Choose a PDF, DOCX, or TXT file.')
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
      body.append('requestId', requestId.current)
      if (tab === 'file') body.append('file', file)
      else body.append('text', text)
      const session = await api('/submissions', { method: 'POST', body })
      navigate(`/session/${session.id}`)
    } catch (error) { setError(error.message) } finally { setBusy(false) }
  }
  return <div className="page student-page"><a href="#/" className="back-link"><Icon name="back" size={16} />Back to home</a>
    <div className="page-heading"><span className="eyebrow">YOUR WORK IS THE STARTING POINT</span><h1>Let’s hear your thinking.</h1><p>Bring your assignment. We’ll take it one question at a time.</p></div>
    <div className="upload-layout"><form className="panel upload-panel" onSubmit={submit}><div className="panel-heading"><span className="icon-tile"><Icon name="upload" /></span><div><h2>Your assignment</h2><p>A little context for a meaningful conversation.</p></div></div>
      <fieldset disabled={busy}><div className="form-grid"><label>Your name<input value={student} onChange={e => { setStudent(e.target.value); requestId.current = crypto.randomUUID() }} placeholder="e.g. Alex Morgan" required maxLength={100} autoComplete="name" /></label><label>Assignment<select value={currentId} onChange={e => { setSelected(e.target.value); requestId.current = crypto.randomUUID() }} required>{assignments.data?.map(a => <option key={a.id} value={a.id}>{a.title}</option>)}</select></label></div>
      {assignment && <div className="assignment-context"><Icon name="book" size={17} /><p>{assignment.brief}</p></div>}
      <div className="segmented" aria-label="Submission method"><button type="button" className={tab === 'file' ? 'active' : ''} onClick={() => setTab('file')}><Icon name="upload" size={16} />Upload a file</button><button type="button" className={tab === 'text' ? 'active' : ''} onClick={() => setTab('text')}><Icon name="edit" size={16} />Paste text</button></div>
      {tab === 'file' ? <div className={`dropzone ${dragging ? 'dragging' : ''} ${file ? 'has-file' : ''}`} onDragOver={e => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); if (!busy) choose(e.dataTransfer.files[0]) }}><span className="upload-icon"><Icon name={file ? 'file' : 'upload'} size={29} /></span><strong>{file ? file.name : 'Your ideas belong here'}</strong><p>{file ? `${(file.size / 1024).toFixed(0)} KB · Ready to upload` : 'Drag your assignment here, or choose a file.'}</p><Button type="button" variant="white" onClick={() => input.current.click()}>{file ? 'Change file' : 'Choose file'}</Button><small>PDF, DOCX, TXT · Up to 10 MB</small><input ref={input} type="file" accept=".pdf,.docx,.txt" className="visually-hidden" tabIndex={-1} onChange={e => choose(e.target.files[0])} /></div>
      : <label className="paste-label">Assignment text<textarea value={text} onChange={e => { setText(e.target.value); requestId.current = crypto.randomUUID() }} placeholder="Paste the full text of your assignment here…" required minLength={40} maxLength={60000} rows={10} /><span className="field-help">{text.length.toLocaleString()} / 60,000 characters</span></label>}
      <div className="sample-row"><span>Just taking a look?</span><button type="button" className="text-button" onClick={() => { setTab('text'); setText(sampleText); setSelected('sample-python'); setStudent(student || 'Alex Morgan'); requestId.current = crypto.randomUUID() }}>Use a sample assignment <Icon name="arrow" size={14} /></button></div></fieldset>
      <ErrorNotice message={error || assignments.error} onRetry={assignments.error ? assignments.reload : undefined} />
      <Button type="submit" className="full" loading={busy} disabled={!assignment}>{busy ? 'Reading your work & preparing questions…' : 'Upload & prepare my defence'}{!busy && <Icon name="arrow" size={18} />}</Button>
      <p className="form-footnote">{config.mode === 'demo' ? 'Demo mode uses local practice questions. Evidence labels are illustrative.' : 'Your assignment and responses are sent to OpenAI for analysis.'} {config.voice === 'elevenlabs' ? 'Voice recordings are transcribed by ElevenLabs.' : 'Voice uses your browser’s speech services where supported.'}</p>
    </form><aside className="student-guide"><span className="guide-eyebrow">A MOMENT TO MAKE IT YOURS</span><h2>Your work.<br />Your voice.<br /><em>Your understanding.</em></h2><p>No trick questions. Just an opportunity to explain the choices you made.</p><div className="guide-facts"><div><Icon name="mic" /><span><strong>3–6 thoughtful questions</strong><small>Based on your submitted work</small></span></div><div><Icon name="clock" /><span><strong>60 seconds per question</strong><small>A guide, not a judgment</small></span></div><div><Icon name="book" /><span><strong>Your teacher has the final word</strong><small>Every response stays in context</small></span></div></div><div className="accessibility-note"><Icon name="headphones" /><p>Voice comes first.<br /><span>Reading and typing are always an option.</span></p></div></aside></div>
  </div>
}

export function Defence({ sessionId, config }) {
  const resource = useResource(`/sessions/${sessionId}`)
  const [entered, setEntered] = useState(false)
  const session = resource.data
  useEffect(() => { if (session && session.status !== 'active') navigate(`/complete/${session.id}`) }, [session])
  if (resource.error) return <div className="page narrow"><ErrorNotice message={resource.error} onRetry={resource.reload} /></div>
  if (!session) return <Loading />
  if (session.status !== 'active') return <Loading label="Preparing your completion…" />
  if (!entered) return <section className="ready-page narrow"><span className="large-icon"><Icon name="headphones" size={36} /></span><span className="eyebrow">{session.answered ? 'PICK UP WHERE YOU LEFT OFF' : 'YOUR ASSIGNMENT IS READY'}</span><h1>A conversation,<br /><em>at your pace.</em></h1><p>Hi {session.student.split(' ')[0]}. Find a quiet spot and listen to each question. Then tap the microphone to explain your thinking.</p><div className="ready-file"><Icon name="file" /><span>{session.filename}</span><Icon name="check" size={17} /></div><div className="ready-details"><span><Icon name="mic" size={16} />3–6 questions</span><span><Icon name="clock" size={16} />60 seconds each</span></div>{session.mode === 'demo' && <p className="demo-note">Practice mode · questions and evidence labels are illustrative.</p>}<Button onClick={() => setEntered(true)}>{session.answered || session.questionStartedAt ? 'Resume oral defence' : 'Start oral defence'}<Icon name="arrow" size={18} /></Button><small>You can reveal any question or type an answer.</small></section>
  return <Question key={session.question.id} session={session} config={config} onUpdate={resource.setData} />
}

function Question({ session, config, onUpdate }) {
  const [revealed, setRevealed] = useState(false)
  const [typing, setTyping] = useState(false)
  const [answer, setAnswer] = useState('')
  const [method, setMethod] = useState('voice')
  const [startedAt, setStartedAt] = useState(session.questionStartedAt)
  const [endedAt, setEndedAt] = useState(session.responseEndedAt)
  const [time, setTime] = useState(Date.now())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
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
  const voice = useVoice({ session, config, onPresented: present, onEnded: markEnded, onResume: resumeResponse,
    onTranscript: text => { setAnswer(text); setMethod('voice') } })
  useEffect(() => { voice.speak() }, [])
  useEffect(() => {
    if (!startedAt || endedAt) return
    const interval = setInterval(() => setTime(Date.now()), 250)
    return () => clearInterval(interval)
  }, [startedAt, endedAt])
  const remaining = startedAt ? Math.min(session.duration, Math.max(0, session.duration - Math.floor(((endedAt ? Date.parse(endedAt) : time) - Date.parse(startedAt)) / 1000))) : session.duration
  async function reveal() {
    voice.stopSpeaking()
    setRevealed(true)
    try { await present() } catch (error) { setError(error.message) }
  }
  async function submit(skip = false) {
    setBusy(true); setError('')
    try {
      await present()
      const data = await api(`${path}/answers`, { method: 'POST', body: { questionId, transcript: skip ? '' : answer, method: skip ? 'skipped' : method, skip } })
      onUpdate(data)
    } catch (error) { setError(error.message) } finally { if (mounted.current) setBusy(false) }
  }
  return <section className="defence-page"><div className="defence-context">{session.assignmentTitle}</div><div className="defence-progress" aria-label={`${session.answered} questions answered, maximum 6`}>{Array.from({ length: 6 }, (_, i) => <span className={i < session.answered ? 'done' : i === session.answered ? 'current' : ''} key={i} />)}</div><p className="question-counter">Question {session.questionNumber} <span>of up to 6</span></p>
    <div className={`voice-orb ${voice.speaking ? 'is-speaking' : ''}`}><Wave active={voice.speaking} /></div><h1 className="voice-title">{busy ? 'Taking in your thinking…' : voice.speaking ? 'A question for you.' : voice.recording ? 'We’re listening.' : voice.transcribing ? 'Putting your words on paper…' : 'Your turn to share.'}</h1><p className="voice-caption" role="status">{voice.speaking ? 'Listen, then tell us what you think.' : voice.recording ? 'Speak naturally. Tap the microphone when you’re done.' : voice.transcribing ? 'Your response time has been saved.' : 'A few words in your own voice can say a lot.'}</p>
    <div className="question-controls"><Button variant="ghost" onClick={voice.speak} disabled={voice.speaking || voice.recording || voice.requestingMicrophone || voice.transcribing || busy}><Icon name="volume" size={17} />Listen Again</Button><Button variant="ghost" onClick={reveal} disabled={busy} aria-expanded={revealed}><Icon name="eye" size={17} />{revealed ? 'Question visible' : 'See Question'}</Button></div>
    {revealed && <div className="revealed-question">{session.question.text}</div>}
    <div className={`timer ${remaining === 0 ? 'timer-expired' : ''}`} aria-label={`${remaining} seconds remaining`}><Icon name="clock" size={17} /><span>{String(Math.floor(remaining / 60)).padStart(2, '0')}:{String(remaining % 60).padStart(2, '0')}</span></div>
    {remaining === 0 && <p className="timer-note" role="status">The timer has ended. You can still finish your answer.</p>}
    {!typing && <><button className={`answer-mic ${voice.recording ? 'recording' : ''}`} onClick={voice.recording ? voice.stopRecording : voice.startRecording} disabled={!startedAt || voice.speaking || voice.requestingMicrophone || voice.transcribing || busy} aria-label={voice.recording ? 'Stop recording' : 'Record answer'}><Icon name={voice.recording ? 'stop' : 'mic'} size={32} /></button><span className="mic-label">{voice.requestingMicrophone ? 'Getting your microphone ready…' : voice.recording ? 'Finish recording' : answer ? 'Record again' : 'Answer'}</span></>}
    <button className="type-fallback" disabled={voice.recording || voice.requestingMicrophone || voice.transcribing || busy} onClick={() => { setTyping(!typing); if (!typing) setMethod('text') }}><Icon name={typing ? 'mic' : 'keyboard'} size={16} />{typing ? 'Use my voice instead' : 'Can’t speak? Type your answer'}</button>
    {(typing || answer.trim()) && <div className="response-box"><label>{typing ? 'Your answer' : 'Your transcript · review before sending'}<textarea autoFocus={typing} value={answer} onChange={e => { setAnswer(e.target.value); if (typing) setMethod('text') }} placeholder="Explain your thinking in your own words…" maxLength={12000} rows={4} disabled={busy || voice.recording} /></label><Button onClick={() => submit()} loading={busy} disabled={!startedAt || !answer.trim() || voice.recording || voice.requestingMicrophone || voice.transcribing || voice.speaking}>Send answer <Icon name="arrow" size={17} /></Button></div>}
    <ErrorNotice message={error || voice.error} onRetry={voice.error && voice.retryTranscription && !voice.transcribing ? voice.retryTranscription : undefined} />
    <button className="skip-button" onClick={() => submit(true)} disabled={!startedAt || busy || voice.recording || voice.requestingMicrophone || voice.speaking || voice.transcribing}>I’m not sure · skip this question</button><div className="defence-bottom"><Icon name="shield" size={14} /><span>Your teacher reviews the evidence. This is a conversation, not a verdict.</span></div>
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
  if (session.status === 'active') return <div className="ready-page narrow"><h1>Your conversation is still open.</h1><a className="button button-primary" href={`#/session/${sessionId}`}>Resume oral defence <Icon name="arrow" /></a></div>
  const completed = session.status === 'completed'
  return <section className="completion-page narrow"><div className="completion-seal"><Icon name="check" size={42} /></div><span className="eyebrow">YOUR THINKING, HEARD</span><h1>Oral defence<br /><em>completed.</em></h1><p>Your responses have been submitted to your teacher for review.</p><div className="completion-summary"><span className="icon-tile"><Icon name="file" /></span><div><strong>{session.assignmentTitle}</strong><small>{session.answered} responses saved · {session.student}</small></div><Badge status={completed ? 'completed' : 'pending'}>{completed ? 'Submitted' : 'Report pending'}</Badge></div>{!completed && <div className="panel report-pending"><p>Your answers are safely stored. The report could not be finished yet.</p><ErrorNotice message={error} /><Button onClick={retry} loading={busy}>Retry report generation</Button></div>}<p className="completion-note">There’s no automatic grade or verdict here.<br />Your teacher will consider your responses in context.</p><a className="button button-primary" href="#/">Back to home <Icon name="arrow" size={18} /></a>{completed && <a className="text-button demo-report-link" href={`#/teacher/report/${session.reportId}`}>Open report in teacher demo <Icon name="arrow" size={15} /></a>}</section>
}
