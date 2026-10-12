import React, { useEffect, useRef, useState } from 'react'
import { api, navigate, useResource, date, seconds } from './api.js'
import { Icon, Button, Badge, ErrorNotice, Loading, Empty, ListMore } from './components.jsx'
import { CreateAssignment, AssignmentRubric, WorkGrade } from './Grading.jsx'
import InterviewResults from './InterviewResults.jsx'
import {reportModeLabel} from '../shared/report-results.js'
import { ActivityEvidence } from './Integrity.jsx'
import { ShowcaseEntry } from './Showcase.jsx'
import { AssignmentSettings, TimingSelect, ReviewForm, ConceptEvidence, SubmissionInbox, ProviderSettings, CohortInsights, SourceDocument, FocusedFollowUp, FollowUpComparison, EvidenceReceiptCard } from './Assessment.jsx'

export function TeacherDashboard({ config }) {
  const assignments = useResource('/assignments')
  const submissions = useResource('/submissions')
  const [tab, setTab] = useState('assignments')
  const [assignmentLimit,setAssignmentLimit]=useState(3)
  const [creating, setCreating] = useState(false)
  const [insightsOpen,setInsightsOpen]=useState(false)
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')
  const [deletedAssignment,setDeletedAssignment]=useState(null)
  useEffect(()=>{sessionStorage.removeItem('merit-lens-deleted-assignment')},[])
  useEffect(()=>{if(!deletedAssignment)return;const t=setTimeout(()=>setDeletedAssignment(null),12000);return()=>clearTimeout(t)},[deletedAssignment])
  async function removeAssignment(assignment){setError('');try{await api('/assignments/'+assignment.id,{method:'DELETE'});setDeletedAssignment(assignment);assignments.reload();submissions.reload()}catch(e){setError(e.message)}}
  async function undoDelete(){try{await api('/assignments/'+deletedAssignment.id+'/restore',{method:'POST',body:{}});sessionStorage.removeItem('merit-lens-deleted-assignment');setDeletedAssignment(null);assignments.reload();submissions.reload()}catch(e){setError(e.message)}}
  useEffect(()=>{const timer=setInterval(()=>submissions.reload(),5000);return()=>clearInterval(timer)},[submissions.reload])
  const submissionCount = submissions.data ? new Set(submissions.data.map(s => s.id)).size : 0
  const completed = submissions.data?.filter(s => s.status === 'held' || s.status === 'completed' && s.review_status === 'pending').length || 0
  async function finishReport(sessionId) {
    setBusyId(sessionId); setError('')
    try { const session = await api(`/sessions/${sessionId}/report`, { method: 'POST' }); navigate(`/teacher/report/${session.reportId}`) }
    catch (error) { setError(error.message) } finally { setBusyId('') }
  }
  return <div className="page dashboard"><div className="page-heading heading-row"><div><h1>Your assignments</h1></div><Button onClick={() => setCreating(true)}><Icon name="plus" size={18} />Create assignment</Button></div>
    {deletedAssignment&&<div className="success-notice"><span>Assignment deleted</span><button className="text-button" onClick={undoDelete}>Undo</button></div>}<div className="dashboard-content"><div className="section-tabs"><button className={tab === 'assignments' ? 'active' : ''} onClick={() => setTab('assignments')}>Assignments<span>{assignments.data?.length || 0}</span></button><button className={tab === 'submissions' ? 'active' : ''} onClick={() => { setTab('submissions'); submissions.reload() }}>Student submissions<span>{submissionCount}</span></button><button className="refresh-button" onClick={() => { assignments.reload(); submissions.reload() }}>Refresh</button></div>
      <ErrorNotice message={error || assignments.error || submissions.error} onRetry={() => { assignments.reload(); submissions.reload() }} />
      {tab === 'assignments' ? !assignments.data ? <Loading /> : <><div className="assignment-cards assignment-card-grid">{assignments.data.slice(0,assignmentLimit).map(a => <div className="assignment-list-row" key={a.id}><a className="assignment-card" href={`#/teacher/assignment/${a.id}`} key={a.id}><div className="assignment-list-title"><h2>{a.title}</h2><span>{a.subject}</span></div><Badge status={a.status==='closed'?'neutral':'approved'}>{a.status==='closed'?'Closed':'Open'}</Badge><p className="assignment-card-brief" data-preserve-text>{a.brief}</p><span className="assignment-list-count"><span>{a.submission_count} submissions</span><small>{submissions.data?.filter(s=>s.assignment_id===a.id&&s.review_status==='pending').length||0} to review</small></span><Icon name="arrow" size={18}/></a><button className="icon-button assignment-delete" aria-label={'Delete assignment: '+a.title} onClick={()=>removeAssignment(a)}><Icon name="trash" size={17}/></button></div>)}</div><ListMore total={assignments.data.length} limit={assignmentLimit} onChange={setAssignmentLimit} label="assignments"/><details className="panel merged-insights" onToggle={e=>setInsightsOpen(e.currentTarget.open)}><summary>Concept insights</summary>{insightsOpen&&<CohortInsights/>}</details></>
        : !submissions.data ? <Loading /> : !submissions.data.length ? <Empty title="No submissions yet" icon="people">Share an assignment link with a student. Their responses and reports will appear here.</Empty> : <SubmissionInbox submissions={submissions.data} assignments={assignments.data || []} busyId={busyId} onFinish={finishReport} />}
    </div>
    {creating && <CreateAssignment onClose={() => setCreating(false)} />}
  </div>
}

export function AssignmentEditor({assignmentId}){
 const resource=useResource('/teacher/assignments/'+assignmentId),[share,setShare]=useState(false),[error,setError]=useState('')
 const assignment=resource.data
 async function remove(){try{await api('/assignments/'+assignmentId,{method:'DELETE'});sessionStorage.setItem('merit-lens-deleted-assignment',JSON.stringify({id:assignmentId,title:assignment.title}));navigate('/teacher')}catch(e){setError(e.message)}}
 async function copy(){setShare(true);try{await navigator.clipboard.writeText(window.location.origin+'/#/student/'+assignmentId)}catch{}}
 if(resource.error)return <div className="page"><ErrorNotice message={resource.error} onRetry={resource.reload}/></div>
 if(!assignment)return <Loading/>
 return <div className="page assignment-editor"><a className="back-link" href="#/teacher"><Icon name="back" size={16}/>All assignments</a><div className="page-heading heading-row"><div><h1>{assignment.title}</h1><p>{assignment.brief}</p></div><div className="inline-actions"><a className="button button-sage" href={'#/student/'+assignmentId}>Preview interview<Icon name="arrow" size={16}/></a><Button variant="white" onClick={copy}><Icon name="link" size={16}/>Share student link</Button><button className="icon-button" aria-label="Delete assignment" onClick={remove}><Icon name="trash" size={18}/></button></div></div>{share&&<label className="share-link">Student link<input readOnly value={window.location.origin+'/#/student/'+assignmentId}/></label>}<ErrorNotice message={error}/><AssignmentRubric key={assignment.id+'-rubric'} assignment={assignment} onSaved={resource.reload}/><AssignmentSettings key={assignment.id} assignment={assignment} onSaved={resource.reload}/></div>
}

export function Report({ reportId }) {
  const reportLanguage=localStorage.getItem('merit-lens-language')==='hu'?'hu':'en'
  const resource=useResource(`/reports/${reportId}?language=${reportLanguage}`),report=resource.data
  if(resource.error)return <div className="page"><ErrorNotice message={resource.error} onRetry={resource.reload}/></div>
  if(!report||report.displayLanguage&&report.displayLanguage!==reportLanguage)return <Loading label={reportLanguage==='hu'?'Jelentés fordítása…':'Loading…'}/>
  return <div className="page report-page compact-report">
    <a className="back-link" href="#/teacher"><Icon name="back" size={16}/>All submissions</a>
    <header className="compact-report-header"><div><h1>Report</h1><p><strong>{report.student}</strong> · {report.assignmentTitle}</p></div><a className="button button-primary" href={'/api/reports/'+report.id+'/download?language='+reportLanguage} download><Icon name="download" size={17}/>Download PDF</a></header>
    <div className="compact-report-meta"><span className="report-mode">{reportModeLabel(report)}</span><span>{date(report.created_at)}</span><span>{report.answers.length} responses</span>{report.meeting?.endedForDeparture?<span>Interview ended early</span>:report.defenceSkipped?<span>Interview skipped</span>:null}{report.mode==='demo'&&<span>Demo evidence · illustrative only</span>}{report.showcaseKind&&<span>Fictional example</span>}</div>
    {report.offTopicSummary?.flagged&&<div className="success-notice off-topic-notice"><strong>Repeated off-topic answers</strong><span>{report.offTopicSummary.count} answers flagged for teacher review.</span></div>}
    <WorkGrade key={report.id+'-grade'} report={report} onSaved={resource.reload} compact/>
    <InterviewResults key={report.id} report={report}/>
    <details className="panel report-extra"><summary>Teacher review</summary><ReviewForm key={report.id} report={report} onSaved={resource.reload}/><FocusedFollowUp key={report.id+'-follow-up'} report={report} onSaved={resource.reload}/></details>
    <details className="panel report-extra"><summary>Submitted work</summary><pre className="teacher-source-preview">{report.submittedText}</pre></details>
    <details className="panel report-extra"><summary>Session details</summary><FollowUpComparison report={report}/><ActivityEvidence activity={report.activity}/>{report.meeting?.draft?.text&&<details><summary>Unsubmitted draft</summary><p>{report.meeting.draft.text}</p></details>}<EvidenceReceiptCard key={report.id+'-receipt'} report={report}/></details>
  </div>
}
