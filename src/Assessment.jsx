import {reportModeLabel} from '../shared/report-results.js'
import React, { useState } from 'react'
import { api, useResource, date } from './api.js'
import { Badge, Button, ErrorNotice, Icon, Empty, ListMore } from './components.jsx'
import { RESPONSE_TIME_OPTIONS, QUESTION_DURATION_SECONDS } from '../shared/timer.js'

export function TimingSelect({ value, onChange, name = 'responseSeconds', defaultDuration = 'adaptive' }) {
  return <label>Response time guide<select name={name} value={value} onChange={onChange} defaultValue={value === undefined ? defaultDuration : undefined}><option value="adaptive">Adaptive · 20–60 seconds</option>{RESPONSE_TIME_OPTIONS.map(n => <option key={n} value={n}>{n < 60 ? n + ' seconds' : (n / 60) + ' minutes'}</option>)}</select><span className="field-help">Students can finish after this guide expires. Timing never affects understanding.</span></label>
}

// Presentation control only; it is deliberately excluded from assignment requests.
export function QuestionCountSelect({ mode = 'standard', value = 'adaptive', onChange }) {
  const counts = mode === 'transfer' ? [4, 6] : [3, 4, 5, 6]
  return <label>Number of questions
    <select value={value} onChange={event => onChange(event.target.value)}>
      <option value="adaptive">Adaptive</option>
      {counts.map(count => <option key={count} value={count}>{count} questions</option>)}
    </select>
  </label>
}

export function AssignmentSettings({ assignment, onSaved }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [challengeMode,setChallengeMode]=useState(assignment.challenge_mode)
  const [questionCount,setQuestionCount]=useState('adaptive')
  const [pairCount,setPairCount]=useState(assignment.concept_count)
  function changeCount(value){setQuestionCount(value)}
  function changeMode(value){setChallengeMode(value);if(value==='transfer'&&questionCount!=='adaptive'&&![4,6].includes(Number(questionCount)))setQuestionCount('adaptive')}
  const [challengeConcepts,setChallengeConcepts]=useState((assignment.challenge_concepts||[]).join(', '))
  async function save(event) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('')
    const values = Object.fromEntries(new FormData(event.currentTarget))
    try {
      await api('/assignments/' + assignment.id, { method: 'PATCH', body: { ...values, challengeConcepts:challengeConcepts.split(',').map(c=>c.trim()).filter(Boolean), pairCount, responseSeconds: values.responseSeconds === 'adaptive' ? QUESTION_DURATION_SECONDS : Number(values.responseSeconds), timingMode: values.responseSeconds === 'adaptive' ? 'adaptive' : 'fixed' } })
      onSaved(); setNotice('Settings saved. Existing interviews keep their original mode and timing.')
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  return <details className="panel assignment-settings"><summary><Icon name="edit" size={17} />Assignment settings <Badge status={assignment.status === 'open' ? 'approved' : 'pending'}>{assignment.status === 'open' ? 'Open for submissions' : 'Closed'}</Badge></summary><form onSubmit={save}><fieldset disabled={busy}><div className="form-grid"><label>Assignment title<input name="title" defaultValue={assignment.title} required maxLength={140} /></label><label>Subject<input name="subject" defaultValue={assignment.subject} required maxLength={100} /></label></div><div className="form-grid"><label>Interview mode<select name="challengeMode" value={challengeMode} onChange={e=>changeMode(e.target.value)}><option value="transfer">Understanding transfer</option><option value="standard">Standard oral defence</option></select></label><QuestionCountSelect mode={challengeMode} value={questionCount} onChange={changeCount}/>{challengeMode==='transfer'&&<label>Concepts to test<select name="pairCount" value={pairCount} onChange={e=>setPairCount(Number(e.target.value))}><option value={2}>2 concepts · 4 questions</option><option value={3}>3 concepts · 6 questions</option></select></label>}</div>{challengeMode==='transfer'&&<label className="challenge-concepts">Concepts to evaluate<input value={challengeConcepts} onChange={e=>setChallengeConcepts(e.target.value)} maxLength={480} placeholder="e.g. Slope, Point on a curve · optional"/></label>}<label>Assignment brief<textarea name="brief" defaultValue={assignment.brief} rows={4} required maxLength={8000} /></label><div className="form-grid"><TimingSelect key={assignment.response_seconds} defaultDuration={assignment.timing_mode === 'adaptive' ? 'adaptive' : assignment.response_seconds} /><label>Submission availability<select name="status" defaultValue={assignment.status}><option value="open">Open for submissions</option><option value="closed">Closed for new submissions</option></select><span className="field-help">Students with an existing interview can still finish it.</span></label></div></fieldset><ErrorNotice message={error} />{notice && <p className="success-notice" role="status">{notice}</p>}<Button type="submit" loading={busy}>Save assignment settings</Button></form></details>
}

const attemptLabel=s=>{const meeting=typeof s.meeting==='string'?JSON.parse(s.meeting||'{}'):s.meeting||{};return meeting.endedForDeparture?(s.status==='reporting'?'Ended · report pending':'Ended · incomplete'):s.status==='completed'?decisions[s.review_status||'pending']:s.status==='reporting'?'Report pending':s.status==='held'?'Meeting needs review':meeting.lifecycle?.departingAt?'Closing interview':!s.question_started_at&&!meeting.enabled?'Not started':'In progress'}
const decisions = { pending: 'Awaiting review', reviewed: 'Reviewed', 'follow-up': 'Follow-up needed' }
export function ReviewForm({ report, onSaved }) {
  const [status, setStatus] = useState(report.review_status || 'pending')
  const [notes, setNotes] = useState(report.teacher_notes || '')
  const [feedback, setFeedback] = useState(report.feedback || '')
  const [release, setRelease] = useState(Boolean(report.released_at))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  async function save(event) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('')
    try { await api('/reports/' + report.id + '/review', { method: 'PATCH', body: { status, notes, feedback, release } }); onSaved(); setNotice(release ? 'Review saved and feedback released to the student.' : 'Review saved. Feedback is held for your review.') }
    catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  return <section id="teacher-review" className="panel teacher-review"><div className="section-heading"><div><h2>Teacher review</h2></div><Badge status={status === 'reviewed' ? 'approved' : 'pending'}>{decisions[status]}</Badge></div><form onSubmit={save}><fieldset disabled={busy}><label>Review decision<select value={status} onChange={e => { setStatus(e.target.value); if (e.target.value === 'pending') setRelease(false) }}>{Object.entries(decisions).map(([key, title]) => <option value={key} key={key}>{title}</option>)}</select></label><div className="form-grid"><label>Private teacher notes<textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4} maxLength={8000} placeholder="What does the evidence establish? What needs another conversation?" /></label><label>Feedback for the student<textarea value={feedback} onChange={e => setFeedback(e.target.value)} rows={4} maxLength={8000} placeholder="Recognize a strength and give a specific next step." /></label></div><label className="checkbox-label"><input type="checkbox" checked={release} disabled={status === 'pending'} onChange={e => setRelease(e.target.checked)} />Release feedback to the student</label></fieldset><ErrorNotice message={error} />{notice && <p className="success-notice" role="status">{notice}</p>}<div className="inline-actions"><Button type="submit" loading={busy}>Save review{release ? ' & release feedback' : ''}</Button><Button type="button" variant="white" onClick={() => window.print()}>Print / save report</Button></div></form></section>
}

export function SubmissionInbox({ submissions, assignments, busyId, onFinish }) {
  const [limit,setLimit]=useState(3)
  const [search, setSearch] = useState('')
  const [assignment, setAssignment] = useState('all')
  const [filter, setFilter] = useState('all')
  const rows = submissions.filter(s => (assignment === 'all' || s.assignment_id === assignment)
    && (s.student + ' ' + s.assignment_title).toLowerCase().includes(search.toLowerCase())
    && (filter === 'all' || (filter === 'active' ? s.status === 'active' : filter === 'pending' ? s.status === 'held' || s.status === 'completed' && s.review_status === 'pending'
      : filter === 'follow-up' ? s.review_status === 'follow-up' : filter === 'reviewed' ? s.review_status === 'reviewed' : Boolean(s.defence_skipped) || s.review_count > 0)))
  return <>{submissions.length>3&&<details className="inbox-filter-toggle"><summary>Filter submissions</summary><div className="inbox-filters"><label>Find a student<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or assignment" /></label><label>Assignment<select value={assignment} onChange={e => setAssignment(e.target.value)}><option value="all">All assignments</option>{assignments.map(a => <option value={a.id} key={a.id}>{a.title}</option>)}</select></label><label>Review queue<select value={filter} onChange={e => setFilter(e.target.value)}><option value="all">All submissions</option><option value="pending">Awaiting teacher review</option><option value="evidence">Has gaps or skipped defence</option><option value="follow-up">Teacher requested follow-up</option><option value="reviewed">Reviewed</option><option value="active">In progress</option></select></label></div></details>}{!rows.length ? <Empty title="No matching submissions" icon="people">Try another name, assignment, or review filter.</Empty> : <div className="submission-list">{rows.slice(0,limit).map(s => <div className="submission-row" key={s.session_id}><span className="avatar">{s.student.slice(0,1).toUpperCase()}</span><div className="submission-name"><strong>{s.student}</strong><small>{s.assignment_title}</small>{s.parent_session_id && <small className="follow-up-label">Focused follow-up</small>}{s.off_topic_count>=2&&<small className="danger-text">Repeated off-topic answers</small>}{Boolean(s.defence_skipped) && <small className="danger-text">Defence skipped</small>}</div><div className="submission-meta"><span>{date(s.created_at)}</span><small>{s.answer_count?s.answer_count+' responses · '+(s.mode==='demo'?'Practice evidence':'AI evidence'):'No interview answers'}</small>{s.released_at && <small>Feedback released</small>}</div><Badge status={s.review_status === 'reviewed' ? 'approved' : s.status === 'active' ? 'active' : 'pending'}>{attemptLabel(s)}</Badge>{s.status === 'held' ? <a className="button button-white button-small" href={'#/teacher/meeting/'+s.session_id}>Review stopped meeting</a> : s.report_id ? <a className="button button-white button-small" href={'#/teacher/report/' + s.report_id}>View report<Icon name="arrow" size={16} /></a> : s.status === 'reporting' ? <Button variant="white" className="button-small" loading={busyId === s.session_id} onClick={() => onFinish(s.session_id)}>Generate report</Button> : <span className="muted small">{attemptLabel(s)}</span>}</div>)}</div>}<ListMore total={rows.length} limit={limit} onChange={setLimit} label="submissions"/></>
}

export function StudentFeedback({ sessionId }) {
  const resource = useResource('/sessions/' + sessionId + '/feedback')
  return <section className="panel student-feedback"><h2>Feedback from your teacher</h2>{resource.data?.available ? <><Badge status={resource.data.status === 'reviewed' ? 'approved' : 'pending'}>{decisions[resource.data.status]}</Badge>{resource.data.grade&&<div className="released-grade"><strong>{resource.data.grade.score} / {resource.data.grade.total}</strong><p>{resource.data.grade.feedback}</p></div>}<p className="feedback-copy">{resource.data.feedback}</p><small>Released {date(resource.data.releasedAt)}</small>{resource.data.followUpSessionId && <a className="button button-primary" href={'#/session/' + resource.data.followUpSessionId}>Start your focused follow-up<Icon name="arrow" size={16} /></a>}</> : <p>Waiting for your teacher’s feedback.</p>}<ErrorNotice message={resource.error} /><Button variant="white" onClick={resource.reload}>Check for feedback</Button></section>
}

export function ProviderSettings({ config, expanded=false }) {
  const [checking, setChecking] = useState(false)
  const [saving, setSaving] = useState(false)
  const [health, setHealth] = useState(null)
  const [error, setError] = useState('')
  async function check() {
    setChecking(true); setError('')
    try { setHealth(await api('/settings/providers/check', { method: 'POST', body: {} })); window.dispatchEvent(new Event('merit-lens-config')) }
    catch (e) { setError(e.message) } finally { setChecking(false) }
  }
  async function mode(next) {
    setSaving(true); setError('')
    try { await api('/settings/mode', { method: 'POST', body: { mode: next } }); window.dispatchEvent(new Event('merit-lens-config')) }
    catch(e) { setError(e.message) } finally { setSaving(false) }
  }
  return <details className="panel provider-settings" open={expanded}><summary><Icon name="spark" size={17} />AI & voice <Badge status={config.mode === 'demo' ? 'pending' : config.providerHealth?.openai === 'connected' ? 'approved' : 'pending'}>{config.mode === 'demo' ? 'Practice mode' : config.providerHealth?.openai === 'error' ? 'Setup needed' : config.providerHealth?.openai === 'connected' ? 'Verified connection' : 'Not verified'}</Badge></summary><p>Live AI analyzes new submissions. Practice mode uses demonstration rules.</p><div className="provider-status"><div><strong>Understanding · OpenAI</strong><span>{health?.openai.message || (config.aiConfigured ? 'A key is configured; check it before the demo.' : 'Add OPENAI_API_KEY in the server .env file and restart.')}</span></div><div><strong>Voice · {config.voice === 'elevenlabs' ? 'ElevenLabs' : config.voice === 'openai' ? 'OpenAI' : 'Browser'}{config.voice==='elevenlabs'&&config.voiceName?' · '+config.voiceName:''}</strong><span>{health?.voice.message || (config.voice !== 'browser' ? 'A key is configured; verify voice access below.' : 'Browser audio and dictation where supported. Typing is always available.')}</span></div></div><p className="avatar-connection"><strong>Photo animation</strong><br />Local lip animation · no avatar credits</p><label>Interview voice<select value={config.voice} disabled={saving} onChange={async e => { setSaving(true); setError(''); try { await api('/settings/voice', { method: 'POST', body: { provider: e.target.value } }); setHealth(null); window.dispatchEvent(new Event('merit-lens-config')) } catch(err) { setError(err.message) } finally { setSaving(false) } }}><option value="browser">Browser speech</option><option value="openai" disabled={!config.aiConfigured}>OpenAI voice & transcription</option><option value="elevenlabs" disabled={!config.elevenlabsConfigured}>ElevenLabs voice & transcription</option></select></label><ErrorNotice message={error} /><div className="inline-actions"><Button variant="white" onClick={check} loading={checking}>Check provider connections</Button><Button variant="white" loading={saving} onClick={() => mode(config.mode === 'demo' ? 'live' : 'demo')}>{config.mode === 'demo' ? 'Use live assessment' : 'Use practice mode'}</Button></div></details>
}

export function CohortInsights(){
 const resource=useResource('/insights'),[limit,setLimit]=useState(5)
 if(resource.error)return <ErrorNotice message={resource.error} onRetry={resource.reload}/>
 if(!resource.data)return <p role="status">Loading insights…</p>
 const data=resource.data
 return <section className="cohort-insights">{data.concepts.length?<><div className="table-wrap"><table><thead><tr><th>Concept</th><th>Assignment</th><th>Mode</th><th>Demonstrated</th><th>Partial</th><th>Unclear</th></tr></thead><tbody>{data.concepts.slice(0,limit).map((c,i)=><tr key={i}><td>{c.concept}</td><td>{data.assignments.find(a=>a.id===c.assignmentId)?.title}</td><td>{reportModeLabel(c)}</td><td>{c.DEMONSTRATED}</td><td>{c.PARTIAL}</td><td>{c.UNCLEAR}</td></tr>)}</tbody></table></div><ListMore total={data.concepts.length} limit={limit} step={5} onChange={setLimit} label="concepts"/></>:<p>No interview concept evidence yet.</p>}</section>
}

export function FocusedFollowUp({ report, onSaved }) {
  const choices = report.availableFollowUpConcepts || [...new Set(report.conceptEvidence.map(c => c.concept))]
  const gaps = report.conceptEvidence.filter(c => c.status !== 'DEMONSTRATED').map(c => c.concept)
  const [selected, setSelected] = useState(gaps.length ? gaps.slice(0, 3) : choices.slice(0, 3))
  const [sessionId, setSessionId] = useState(report.followUpSessionId || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const link = sessionId ? window.location.origin + '/#/session/' + sessionId : ''
  async function create() {
    setBusy(true); setError(''); setNotice('')
    try { const session = await api('/reports/' + report.id + '/follow-up', { method: 'POST', body: { concepts: selected } }); setSessionId(session.id); onSaved(); setNotice('Focused interview prepared. The original evidence is preserved for comparison.') }
    catch(e) { setError(e.message) } finally { setBusy(false) }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(link); setNotice('Follow-up link copied. Share it with the student when you are ready.') }
    catch { setNotice('Copy the link below to share the focused interview.') }
  }
  return <section id="teacher-follow-up" className="panel focused-follow-up"><div className="section-heading"><div><span className="eyebrow">MAKE THE EVIDENCE USEFUL</span><h2>Offer a focused second chance</h2><p>A short follow-up can distinguish a remaining gap from a misunderstanding that the student can clarify.</p></div><span className="icon-tile"><Icon name="spark" /></span></div>{!sessionId ? <><div className="follow-up-concepts">{choices.map(concept => <label className="checkbox-label" key={concept}><input type="checkbox" checked={selected.includes(concept)} disabled={busy || !selected.includes(concept) && selected.length >= 3} onChange={e => setSelected(e.target.checked ? [...selected, concept] : selected.filter(c => c !== concept))} />{concept}</label>)}</div><p className="field-help">Select one to three concepts. The student keeps their original submission and response time guide.</p><Button onClick={create} loading={busy} disabled={!selected.length}>Create focused interview<Icon name="arrow" size={17} /></Button></> : <div className="follow-up-ready"><Badge status={report.followUpStatus === 'completed' ? 'approved' : 'pending'}>{report.followUpStatus === 'completed' ? 'Follow-up completed' : 'Follow-up ready'}</Badge><p className="follow-up-focus">Focus: {report.followUpConcepts?.join(', ') || selected.join(', ')}</p><label>Student follow-up link<input readOnly value={link} onFocus={e => e.target.select()} /></label><div className="inline-actions"><Button variant="white" onClick={copy}>Copy follow-up link<Icon name="link" size={16} /></Button>{report.followUpReportId ? <a className="button button-primary" href={'#/teacher/report/' + report.followUpReportId}>Compare the new evidence<Icon name="arrow" size={16} /></a> : <a className="button button-primary" href={'#/session/' + sessionId}>Preview student follow-up<Icon name="arrow" size={16} /></a>}</div></div>}<ErrorNotice message={error} />{notice && <p className="success-notice" role="status">{notice}</p>}</section>
}

export function FollowUpComparison({ report }) {
  if (!report.isFollowUp) return null
  return <section className="panel follow-up-comparison"><div className="section-heading"><div><span className="eyebrow">THE LEARNING CONTINUES</span><h2>Evidence across two interviews</h2><p>The new interview is assessed on its own answers. The earlier evidence remains available.</p></div><a className="button button-white button-small" href={'#/teacher/report/' + report.previousReportId}>Read the first interview<Icon name="back" size={16} /></a></div><div className="comparison-grid">{report.conceptEvidence.map((current, i) => { const previous = report.previousConceptEvidence.find(c => c.concept === current.concept); return <div key={i}><strong>{current.concept}</strong><div className="comparison-status"><span><small>First interview</small><Badge status={previous?.status || 'UNCLEAR'}>{previous ? undefined : 'No evidence'}</Badge></span><Icon name="arrow" size={18} /><span><small>Focused follow-up</small><Badge status={current.status} /></span></div><p>{current.reasoning}</p></div> })}</div></section>
}
export function EvidenceReceiptCard({ report }) {
  const [receipt, setReceipt] = useState(report.evidenceReceipt)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [checked, setChecked] = useState(false)
  async function verify() {
    setBusy(true); setError('')
    try { setReceipt(await api('/reports/' + report.id + '/receipt')); setChecked(true) }
    catch(e) { setError(e.message) } finally { setBusy(false) }
  }
  if (!receipt) return null
  return <section className={'evidence-receipt compact-saved-record ' + (receipt.matches ? '' : 'receipt-changed')}>
   <div className="receipt-copy"><strong>Saved record</strong><p>{receipt.matches?'The saved submission, answers and AI findings are unchanged.':'The saved record has changed. Check the answers before using this report.'}</p><small>{receipt.answerCount} responses · Created {date(receipt.createdAt)}</small>{checked&&<span className="receipt-confirmation" role="status">{receipt.matches?'Checked now: saved record unchanged.':'Checked now: changes found.'}</span>}</div>
   <div className="receipt-actions"><Button variant="white" className="button-small" loading={busy} onClick={verify}>Check saved record<Icon name="check" size={15}/></Button><a className="button button-white button-small" href={'/api/reports/'+report.id+'/receipt?format=text&language='+(localStorage.getItem('merit-lens-language')==='hu'?'hu':'en')} download>Download record (.txt)<Icon name="download" size={15}/></a></div>
   <ErrorNotice message={error}/><details className="receipt-details"><summary>Technical details</summary><p>This checks for changes to the saved work, answers and AI findings. It does not verify identity or answer correctness.</p><p className="receipt-fingerprint">SHA-256 · {receipt.fingerprint}</p><a href={'/api/reports/'+report.id+'/receipt'} download>Download JSON</a></details>
  </section>
}
