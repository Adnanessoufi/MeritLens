import React, { useEffect, useRef, useState } from 'react'
import { api, navigate, useResource, date, seconds } from './api.js'
import { Icon, Button, Badge, ErrorNotice, Loading, Empty } from './components.jsx'

export function TeacherDashboard() {
  const assignments = useResource('/assignments')
  const submissions = useResource('/submissions')
  const [tab, setTab] = useState('assignments')
  const [creating, setCreating] = useState(false)
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')
  const completed = submissions.data?.filter(s => s.status === 'completed').length || 0
  async function finishReport(sessionId) {
    setBusyId(sessionId); setError('')
    try { const session = await api(`/sessions/${sessionId}/report`, { method: 'POST' }); navigate(`/teacher/report/${session.reportId}`) }
    catch (error) { setError(error.message) } finally { setBusyId('') }
  }
  return <div className="page dashboard"><div className="dashboard-greeting"><span className="eyebrow">THE TEACHER WORKSPACE</span><span className="date-label">A clearer view of learning</span></div><div className="page-heading heading-row"><div><h1>See the thinking<br /><em>behind the work.</em></h1><p>A space for thoughtful questions and meaningful evidence.</p></div><Button onClick={() => setCreating(true)}><Icon name="plus" size={18} />Create assignment</Button></div>
    <div className="stats-grid"><div className="stat-card"><span className="icon-tile"><Icon name="book" /></span><div><strong>{assignments.data?.length ?? '—'}</strong><span>Assignments</span></div></div><div className="stat-card"><span className="icon-tile peach"><Icon name="people" /></span><div><strong>{submissions.data?.length ?? '—'}</strong><span>Student submissions</span></div></div><div className="stat-card"><span className="icon-tile sage"><Icon name="check" /></span><div><strong>{completed}</strong><span>Reports ready to review</span></div></div>
    </div><div className="dashboard-content"><div className="section-tabs"><button className={tab === 'assignments' ? 'active' : ''} onClick={() => setTab('assignments')}>Assignments<span>{assignments.data?.length || 0}</span></button><button className={tab === 'submissions' ? 'active' : ''} onClick={() => { setTab('submissions'); submissions.reload() }}>Student submissions<span>{submissions.data?.length || 0}</span></button><button className="refresh-button" onClick={() => { assignments.reload(); submissions.reload() }}>Refresh</button></div>
      <ErrorNotice message={error || assignments.error || submissions.error} onRetry={() => { assignments.reload(); submissions.reload() }} />
      {tab === 'assignments' ? !assignments.data ? <Loading /> : <div className="assignment-cards">{assignments.data.map(a => <a className="assignment-card" href={`#/teacher/assignment/${a.id}`} key={a.id}><div className="assignment-card-top"><span className="icon-tile"><Icon name="book" size={22} /></span><Badge status={a.approved_count ? 'approved' : 'pending'}>{a.approved_count ? 'Questions ready' : 'Needs questions'}</Badge></div><span className="subject-label">{a.subject}</span><h2>{a.title}</h2><p>{a.brief}</p><div className="concept-tags">{a.concepts.slice(0, 3).map(c => <span key={c}>{c}</span>)}</div><div className="assignment-card-footer"><span><Icon name="people" size={15} />{a.submission_count} submissions</span><span>{a.approved_count} approved<Icon name="arrow" size={17} /></span></div></a>)}<button className="new-assignment-card" onClick={() => setCreating(true)}><span className="new-plus"><Icon name="plus" size={26} /></span><strong>A new opportunity to understand</strong><span>Create an assignment</span></button></div>
        : !submissions.data ? <Loading /> : !submissions.data.length ? <Empty title="The conversation starts with an assignment." icon="people">Share an assignment link with a student. Their responses and reports will appear here.</Empty> : <div className="submission-list">{submissions.data.map(s => <div className="submission-row" key={s.id}><span className="avatar">{s.student.slice(0, 1).toUpperCase()}</span><div className="submission-name"><strong>{s.student}</strong><small>{s.assignment_title}</small></div><div className="submission-meta"><span>{date(s.created_at)}</span><small>{s.answer_count} responses · {s.mode === 'demo' ? 'Demo evidence' : 'AI evidence'}</small></div><Badge status={s.status}>{s.status === 'completed' ? 'Ready to review' : s.status === 'reporting' ? 'Report pending' : 'In progress'}</Badge>{s.report_id ? <a className="button button-white button-small" href={`#/teacher/report/${s.report_id}`}>View report<Icon name="arrow" size={16} /></a> : s.status === 'reporting' ? <Button variant="white" className="button-small" loading={busyId === s.session_id} onClick={() => finishReport(s.session_id)}>Generate report</Button> : <span className="muted small">Awaiting completion</span>}</div>)}</div>}
    </div><div className="teacher-principle"><Icon name="shield" size={22} /><div><strong>Evidence informs. You decide.</strong><p>Merit Lens checks understanding, not authorship. Every report is a starting point for your review.</p></div></div>
    {creating && <CreateAssignment onClose={() => setCreating(false)} />}
  </div>
}

function CreateAssignment({ onClose }) {
  const dialog = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { dialog.current.showModal() }, [])
  async function create(event) {
    event.preventDefault(); setBusy(true); setError('')
    const values = Object.fromEntries(new FormData(event.currentTarget))
    try {
      const assignment = await api('/assignments', { method: 'POST', body: { ...values, concepts: values.concepts.split(/[\n,]/).map(s => s.trim()).filter(Boolean) } })
      navigate(`/teacher/assignment/${assignment.id}`)
    } catch (error) { setError(error.message) } finally { setBusy(false) }
  }
  return <dialog className="modal" ref={dialog} onCancel={event => { if (busy) event.preventDefault(); else onClose() }} aria-labelledby="create-title"><div className="modal-header"><span className="icon-tile"><Icon name="book" /></span><button className="icon-button" aria-label="Close assignment form" onClick={onClose} disabled={busy}><Icon name="close" /></button></div><h2 id="create-title">Start with a good question.</h2><p>Create an assignment, then shape the conversation with your own questions or AI suggestions.</p><form onSubmit={create}><fieldset disabled={busy}><label>Assignment title<input name="title" placeholder="e.g. Sustainable cities research project" required maxLength={140} autoFocus /></label><label>Subject<input name="subject" placeholder="e.g. Environmental science" maxLength={100} /></label><label>Assignment brief<textarea name="brief" rows={4} placeholder="What did you ask your students to explore?" required maxLength={8000} /></label><label>Core concepts <span className="optional">optional</span><textarea name="concepts" rows={2} placeholder="Urban planning, carbon emissions, research methods" /><span className="field-help">Separate concepts with commas or new lines. Up to 12.</span></label></fieldset><ErrorNotice message={error} /><div className="modal-actions"><Button type="button" variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button><Button type="submit" loading={busy}>Create assignment<Icon name="arrow" size={17} /></Button></div></form></dialog>
}

export function AssignmentEditor({ assignmentId, config }) {
  const resource = useResource(`/assignments/${assignmentId}`)
  const [concepts, setConcepts] = useState(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [share, setShare] = useState(false)
  const [adding, setAdding] = useState(false)
  const assignment = resource.data
  async function action(name, path, options) {
    setBusy(name); setError(''); setNotice('')
    try { await api(path, options); resource.reload(); return true }
    catch (error) { setError(error.message); return false } finally { setBusy('') }
  }
  async function copyLink() {
    setShare(true)
    try { await navigator.clipboard.writeText(`${window.location.origin}/#/student/${assignmentId}`); setNotice('Student link copied. Share it with your students.') }
    catch { setNotice('Copy the student link below to share this assignment.') }
  }
  if (resource.error) return <div className="page"><ErrorNotice message={resource.error} onRetry={resource.reload} /></div>
  if (!assignment) return <Loading />
  return <div className="page assignment-editor"><a className="back-link" href="#/teacher"><Icon name="back" size={16} />All assignments</a><div className="page-heading heading-row"><div><span className="eyebrow">{assignment.subject}</span><h1>{assignment.title}</h1><p>{assignment.brief}</p></div><Button variant="white" onClick={copyLink}><Icon name="link" size={17} />Share student link</Button></div>
    {notice && <div className="success-notice" role="status"><Icon name="check" size={17} />{notice}</div>}{share && <label className="share-link">Student session link<input readOnly value={`${window.location.origin}/#/student/${assignmentId}`} onFocus={e => e.target.select()} /></label>}
    <div className="editor-layout"><section className="panel concepts-panel"><span className="icon-tile"><Icon name="spark" /></span><h2>What matters most?</h2><p>Core concepts guide the questions. Keep them focused on the ideas you want students to explain.</p><label>Core concepts<textarea value={concepts ?? assignment.concepts.join('\n')} onChange={e => setConcepts(e.target.value)} rows={6} placeholder="One concept per line" /></label><Button variant="white" loading={busy === 'concepts'} disabled={Boolean(busy)} onClick={async () => { if (await action('concepts', `/assignments/${assignmentId}`, { method: 'PATCH', body: { concepts: (concepts ?? assignment.concepts.join('\n')).split(/[\n,]/).map(s => s.trim()).filter(Boolean) } })) { setNotice('Core concepts saved.'); setConcepts(null) } }}>Save concepts</Button><div className="small-aside"><Icon name="shield" size={18} /><p>Your approved questions are preferred when they match the student’s work. Adaptive follow-ups can be generated during the defence.</p></div></section>
    <section className="questions-section"><div className="section-heading"><div><h2>Shape the conversation</h2><p>{assignment.questions.filter(q => q.approved).length} approved · {assignment.questions.filter(q => !q.approved).length} awaiting review</p></div><Button variant="white" loading={busy === 'generate'} disabled={Boolean(busy)} onClick={() => action('generate', `/assignments/${assignmentId}/generate`, { method: 'POST', body: {} })}><Icon name="spark" size={17} />{config.mode === 'demo' ? 'Suggest demo questions' : 'Generate questions'}</Button></div><ErrorNotice message={error} />
      <div className="questions-list">{assignment.questions.map((q, i) => <QuestionEditor key={q.id} question={q} number={i + 1} onSaved={resource.reload} />)}</div>
      {!assignment.questions.length && <div className="panel"><Empty title="Every good conversation starts here." icon="mic">Generate questions to review, or add one of your own below.</Empty></div>}
      {adding ? <form className="panel add-question-form" onSubmit={async e => { e.preventDefault(); const body = Object.fromEntries(new FormData(e.currentTarget)); if (await action('add', `/assignments/${assignmentId}/questions`, { method: 'POST', body })) setAdding(false) }}><h3>Your question</h3><label>Concept<input name="concept" required maxLength={160} placeholder="e.g. Research methods" /></label><label>Question<textarea name="text" rows={3} required maxLength={1000} placeholder="What would you like the student to explain?" /></label><div className="inline-actions"><Button type="submit" loading={busy === 'add'}>Add & approve</Button><Button type="button" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button></div></form> : <button className="add-question" onClick={() => setAdding(true)}><Icon name="plus" size={18} />Add your own question</button>}
    </section></div>
  </div>
}

function QuestionEditor({ question, number, onSaved }) {
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function update(options) {
    setBusy(true); setError('')
    try { await api(`/questions/${question.id}`, options); setEditing(false); onSaved() }
    catch (error) { setError(error.message) } finally { setBusy(false) }
  }
  return <article className="question-editor panel"><div className="question-editor-top"><span className="question-index">{String(number).padStart(2, '0')}</span><span className="question-concept">{question.concept}</span><Badge status={question.approved ? 'approved' : 'pending'}>{question.approved ? 'Approved' : 'Review needed'}</Badge></div>{editing ? <form onSubmit={e => { e.preventDefault(); update({ method: 'PATCH', body: { ...Object.fromEntries(new FormData(e.currentTarget)), approved: false } }) }}><label>Concept<input name="concept" defaultValue={question.concept} required maxLength={160} /></label><label>Question<textarea name="text" defaultValue={question.text} rows={3} required maxLength={1000} /></label><div className="inline-actions"><Button type="submit" loading={busy}>Save for review</Button><Button type="button" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button></div></form> : <p className="question-editor-text">{question.text}</p>}<ErrorNotice message={error} />{!editing && <div className="question-editor-footer"><span className="small muted">{question.source === 'teacher' ? 'Added by you' : question.source === 'demo' ? 'Demo suggestion' : 'AI suggestion'}</span><div className="inline-actions">{deleting ? <><span className="small">Delete this question?</span><Button variant="ghost" className="button-small danger-text" loading={busy} onClick={() => update({ method: 'DELETE' })}>Delete</Button><button className="text-button" onClick={() => setDeleting(false)}>Keep</button></> : <><button className="icon-button" aria-label={`Edit question ${number}`} onClick={() => setEditing(true)} disabled={busy}><Icon name="edit" size={17} /></button><button className="icon-button" aria-label={`Delete question ${number}`} onClick={() => setDeleting(true)} disabled={busy}><Icon name="trash" size={17} /></button><Button variant={question.approved ? 'ghost' : 'sage'} className="button-small" loading={busy} onClick={() => update({ method: 'PATCH', body: { approved: !question.approved } })}>{question.approved ? 'Unapprove' : 'Approve'}{!question.approved && <Icon name="check" size={15} />}</Button></>}</div></div>}</article>
}

export function Report({ reportId }) {
  const resource = useResource(`/reports/${reportId}`)
  const report = resource.data
  if (resource.error) return <div className="page"><ErrorNotice message={resource.error} onRetry={resource.reload} /></div>
  if (!report) return <Loading />
  const counts = Object.fromEntries(['DEMONSTRATED', 'PARTIAL', 'UNCLEAR'].map(status => [status, report.answers.filter(a => a.status === status).length]))
  return <div className="page report-page"><a className="back-link" href="#/teacher"><Icon name="back" size={16} />Teacher workspace</a><div className="page-heading heading-row"><div><span className="eyebrow">THE MERIT LENS REPORT</span><h1>Understanding,<br /><em>in their own words.</em></h1></div><Badge status="pending">For teacher review</Badge></div><div className="report-student panel"><span className="avatar large">{report.student.slice(0, 1).toUpperCase()}</span><div><h2>{report.student}</h2><p>{report.assignmentTitle}</p></div><div className="report-student-meta"><span>{date(report.created_at)}</span><small>{report.answers.length} questions · {report.filename}</small></div></div>
    {report.mode === 'demo' && <div className="demo-banner"><Icon name="spark" size={20} /><div><strong>Demo evidence · illustrative only</strong><p>These status labels use simple scripted rules, not an AI understanding assessment. Review the real transcripts below.</p></div></div>}
    <section className="report-summary panel"><div><span className="eyebrow">THE OVERALL PICTURE</span><h2>A starting point for your review.</h2><p>{report.summary}</p></div><div className="evidence-counts">{Object.entries(counts).map(([status, count]) => <div key={status}><strong>{count}</strong><Badge status={status} /></div>)}</div></section>
    <section className="matrix-section"><div className="section-heading"><div><h2>Understanding Evidence Matrix</h2><p>Each observation is grounded in a question and a response.</p></div><span className="small muted">{report.answers.length} evidence points</span></div><div className="table-wrap panel" tabIndex={0} aria-label="Understanding evidence table; scroll horizontally on small screens"><table><thead><tr><th>Concept</th><th>Question</th><th>Understanding</th><th>Evidence</th><th>Response time</th></tr></thead><tbody>{report.answers.map(answer => <tr key={answer.id}><td><strong>{answer.concept}</strong><small>Question {answer.position}</small></td><td>{answer.question}</td><td><Badge status={answer.status} /></td><td>{answer.explanation}</td><td><span className="response-time"><Icon name="clock" size={14} />{seconds(answer.response_seconds)}</span>{answer.timer_expired && <small className="time-expired-label">Timer elapsed</small>}</td></tr>)}</tbody></table></div><p className="matrix-note"><Icon name="clock" size={14} />Response time is supporting context only. It does not determine understanding or imply misconduct.</p></section>
    <div className="report-insights"><section className="panel strengths"><span className="icon-tile"><Icon name="check" /></span><h2>Strengths to recognize</h2>{report.strengths.length ? <ul>{report.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul> : <p>No specific strengths were established from these responses. Review the transcripts for more context.</p>}</section><section className="panel review-areas"><span className="icon-tile peach"><Icon name="book" /></span><h2>Worth a closer conversation</h2>{report.reviewAreas.length ? <ul>{report.reviewAreas.map((s, i) => <li key={i}>{s}</li>)}</ul> : <p>No specific gaps were highlighted. Your review of the complete evidence is still essential.</p>}</section></div>
    <section className="transcripts-section"><div className="section-heading"><div><h2>The conversation, in full</h2><p>The student’s words, with the context that matters.</p></div></div>{report.answers.map((answer, index) => <details className="transcript panel" key={answer.id} open={index === 0}><summary><span className="question-index">{String(answer.position).padStart(2, '0')}</span><strong>{answer.concept}</strong><Badge status={answer.status} /><span className="expand-mark">+</span></summary><div className="transcript-body"><span className="eyebrow">THE QUESTION · {answer.source === 'teacher-approved' ? 'TEACHER-APPROVED' : answer.source.toUpperCase()}</span><h3>{answer.question}</h3><span className="eyebrow">{answer.method === 'voice' ? 'VOICE TRANSCRIPT' : answer.method === 'skipped' ? 'NO RESPONSE' : 'TYPED ANSWER'}</span><blockquote>{answer.transcript || 'The student chose to skip this question.'}</blockquote><div className="transcript-meta"><span><Icon name="clock" size={14} />{seconds(answer.response_seconds)} response time{answer.timer_expired ? ' · timer elapsed' : ''}</span><span>Presented {new Date(answer.question_started_at).toLocaleTimeString()}</span></div><p className="transcript-evidence">{answer.explanation}</p></div></details>)}</section>
    <details className="analysis-details panel"><summary>Assignment context used for questions <Icon name="plus" size={16} /></summary><p>{report.analysis.summary}</p>{report.analysis.concepts.map((c, i) => <div className="analysis-concept" key={i}><h3>{c.name}</h3><blockquote>{c.evidence}</blockquote><p><strong>Method / idea:</strong> {c.method}</p><p><strong>Claim:</strong> {c.claim}</p></div>)}</details>
    <div className="teacher-principle"><Icon name="shield" size={24} /><div><strong>The evidence is here. The judgment is yours.</strong><p>This report does not determine authorship, cheating, or plagiarism. You make the final decision.</p></div></div>
  </div>
}
