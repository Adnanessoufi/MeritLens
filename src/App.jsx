import {PROJECT_DEMO_ID} from '../shared/project-demo.js'
import React, { useEffect, useState } from 'react'
import { prefetchResource, useResource, useRoute } from './api.js'
import { Logo, Icon, ErrorNotice, Loading } from './components.jsx'
import { ProviderSettings } from './Assessment.jsx'
import { MeetingReview } from './Meeting.jsx'
import { StudentUpload, Defence, Completion } from './Student.jsx'
import { TeacherDashboard, AssignmentEditor, Report } from './Teacher.jsx'
import TransferChallenge from './TransferChallenge.jsx'
import Showcase from './Showcase.jsx'
import { languages, useStudentTranslation } from './i18n.js'

export default function App() {
  const route = useRoute()
  const config = useResource('/config')
  useEffect(() => {
    for (const path of ['/assignments', '/submissions']) prefetchResource(path).catch(() => {})
  }, [])
  useEffect(() => { const refresh = () => config.reload(); window.addEventListener('merit-lens-config', refresh); return () => window.removeEventListener('merit-lens-config', refresh) }, [config.reload])
  const [language, setLanguage] = useState(() => {
    const saved = localStorage.getItem('merit-lens-language')
    return Object.hasOwn(languages, saved) ? saved : 'en'
  })
  const teacher = route.startsWith('/teacher')
  const session = route.startsWith('/session/')
  const displayLanguage=teacher&&!['en','hu'].includes(language)?'en':language
  useStudentTranslation(displayLanguage, route)
  const parts = route.split('/').filter(Boolean)
  let content
  if (route === '/') content = <Landing />
  else if (route === '/transfer') content = <StudentUpload key={route} config={config.data || {}} language={language} initialMode="transfer" challengeEntry />
  else if (route === '/transfer/examples') content = <TransferChallenge config={config.data} />
  else if (route === '/showcase') content = <Showcase config={config.data} />
  else if (parts[0] === 'student') content = <StudentUpload key={route} assignmentId={parts[1]==='sample-python'&&parts[2]==='demo'?PROJECT_DEMO_ID:parts[1]} prefillSample={parts[2]==='demo'} config={config.data || {}} language={language} initialMode={parts[2] === 'standard' ? 'standard' : 'transfer'} />
  else if (parts[0] === 'session' && parts[1]) content = <Defence key={parts[1]} sessionId={parts[1]} config={config.data} language={language} onLanguage={value => { localStorage.setItem('merit-lens-language', value); setLanguage(value) }} />
  else if (parts[0] === 'complete' && parts[1]) content = <Completion sessionId={parts[1]} />
  else if (route === '/teacher/settings') content = <div className="page settings-page"><h1>Settings</h1><ProviderSettings config={config.data} expanded /><details className="data-details demo-validation-link"><summary>Demo validation</summary><a className="text-button" href="#/transfer/examples">Saved strong, partial and weak examples</a></details></div>
  else if (route === '/teacher') content = <TeacherDashboard config={config.data} />
  else if (parts[1] === 'assignment' && parts[2]) content = <AssignmentEditor key={parts[2]} assignmentId={parts[2]} config={config.data} />
  else if (parts[1] === 'meeting' && parts[2]) content = <MeetingReview sessionId={parts[2]} />
  else if (parts[1] === 'report' && parts[2]) content = <Report key={parts[2]} reportId={parts[2]} />
  else content = <div className="page narrow"><h1>This page has moved.</h1><a href="#/">Back to Merit Lens</a></div>
  return <div className={`app ${teacher ? 'teacher-app' : ''}`}>
    {teacher && <aside className="sidebar"><Logo /><a className={"sidebar-link "+(route==='/teacher'?'selected':'')} href="#/teacher"><Icon name="grid" />Overview</a><a className="sidebar-link" href="#/teacher/settings"><Icon name="edit"/>Settings</a></aside>}
    <div className="app-main">
      <header className={`header ${session ? 'header-quiet' : ''}`}>
        {!teacher ? <Logo /> : null}
        <nav aria-label="Main navigation">
          {<label className="language-select"><span className="visually-hidden">Language</span><select aria-label="Language" value={displayLanguage} onChange={event => { localStorage.setItem('merit-lens-language', event.target.value); setLanguage(event.target.value) }}>{Object.entries(languages).filter(([code])=>!teacher||['en','hu'].includes(code)).map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select></label>}

          {route === '/' ? null : teacher ? <a className="nav-link" href="#/">Home <Icon name="arrow" size={16} /></a> : !session && <a className="nav-link" href="#/">Back home <Icon name="arrow" size={16} /></a>}
        </nav>
      </header>
      <main key={route}>
        {(route === '/' || route === '/teacher' || parts[0] === 'student') && !config.error ? content : config.error ? <div className="page"><ErrorNotice message={config.error} onRetry={config.reload} /></div> : !config.data ? <Loading /> : content}
      </main>

    </div>
  </div>
}

function Landing() {
  return <section className="page entry-page" aria-labelledby="entry-title">
    <h1 id="entry-title">Choose your workspace</h1>
    <div className="entry-roles">
      <a className="entry-card" href="#/student" aria-label="Student workspace">
        <img src="/assets/student-entry.png" alt="Students on campus" />
        <div><h2>Student</h2><span className="button button-primary">Enter<Icon name="arrow" size={18} /></span></div>
      </a>
      <a className="entry-card" href="#/teacher" aria-label="Teacher workspace">
        <img src="/assets/teacher-entry.webp" alt="Teacher in a classroom" />
        <div><h2>Teacher</h2><span className="button button-primary">Enter<Icon name="arrow" size={18} /></span></div>
      </a>
    </div>
  </section>
}
