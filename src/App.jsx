import React from 'react'
import { useResource, useRoute } from './api.js'
import { Logo, Icon, ErrorNotice, Loading, Wave } from './components.jsx'
import { StudentUpload, Defence, Completion } from './Student.jsx'
import { TeacherDashboard, AssignmentEditor, Report } from './Teacher.jsx'

export default function App() {
  const route = useRoute()
  const config = useResource('/config')
  const teacher = route.startsWith('/teacher')
  const session = route.startsWith('/session/')
  const parts = route.split('/').filter(Boolean)
  let content
  if (route === '/') content = <Landing />
  else if (parts[0] === 'student') content = <StudentUpload key={route} assignmentId={parts[1]} config={config.data} />
  else if (parts[0] === 'session' && parts[1]) content = <Defence key={parts[1]} sessionId={parts[1]} config={config.data} />
  else if (parts[0] === 'complete' && parts[1]) content = <Completion sessionId={parts[1]} />
  else if (route === '/teacher') content = <TeacherDashboard />
  else if (parts[1] === 'assignment' && parts[2]) content = <AssignmentEditor key={parts[2]} assignmentId={parts[2]} config={config.data} />
  else if (parts[1] === 'report' && parts[2]) content = <Report key={parts[2]} reportId={parts[2]} />
  else content = <div className="page narrow"><h1>This page has moved.</h1><a href="#/">Back to Merit Lens</a></div>
  return <div className={`app ${teacher ? 'teacher-app' : ''}`}>
    {teacher && <aside className="sidebar"><Logo /><div className="sidebar-section">YOUR WORKSPACE</div><a className="sidebar-link selected" href="#/teacher"><Icon name="grid" />Overview</a><a className="sidebar-link" href="#/student"><Icon name="headphones" />Student experience<Icon name="arrow" size={16} /></a><div className="sidebar-note"><span className="icon-tile"><Icon name="book" /></span><h3>Understanding comes first.</h3><p>Evidence to support your judgment. The final decision is always yours.</p></div><div className="profile"><span className="avatar">T</span><div><strong>Teacher workspace</strong><small>Hackathon demo access</small></div></div></aside>}
    <div className="app-main">
      <header className={`header ${session ? 'header-quiet' : ''}`}>
        {!teacher ? <Logo /> : <span className="workspace-title">Teaching, with a little more clarity</span>}
        <nav aria-label="Main navigation">
          {config.data && <span className={`mode-label ${config.data.mode === 'demo' ? 'mode-demo' : ''}`}><i />{config.data.mode === 'demo' ? 'Demo mode' : 'AI connected'}</span>}
          {route === '/' ? <a className="nav-link" href="#/teacher">Teacher workspace <Icon name="arrow" size={16} /></a> : teacher ? <a className="nav-link" href="#/">Home <Icon name="arrow" size={16} /></a> : !session && <a className="nav-link" href="#/">Back home <Icon name="arrow" size={16} /></a>}
        </nav>
      </header>
      <main key={route}>
        {config.error ? <div className="page"><ErrorNotice message={config.error} onRetry={config.reload} /></div> : !config.data ? <Loading /> : content}
      </main>
      <footer className="footer"><span>Made for understanding.</span><span><Icon name="shield" size={14} /> Teacher-led. Evidence-informed.</span></footer>
    </div>
  </div>
}

function Landing() {
  return <div className="landing">
    <section className="hero">
      <div className="hero-copy"><span className="eyebrow"><i /> A NEW PERSPECTIVE ON ASSESSMENT</span>
        <h1>Good work deserves<br />a <em>conversation.</em></h1>
        <p className="hero-description">Go beyond the submission. A short, thoughtful oral defence helps students show the understanding behind their work.</p>
        <div className="hero-actions"><a href="#/student" className="button button-primary">I’m a student <Icon name="arrow" size={19} /></a><a href="#/teacher" className="button button-white">I’m a teacher <Icon name="book" size={19} /></a></div>
        <div className="hero-assurance"><Icon name="check" size={16} /><span>Not an AI detector. A window into understanding.</span></div>
      </div>
      <div className="hero-visual" aria-label="A preview of a conversation about your assignment">
        <div className="visual-label"><span /> YOUR WORK. YOUR WORDS.</div>
        <div className="document-preview"><div className="document-top"><Icon name="file" /><span>MY ASSIGNMENT</span><span className="tiny-check"><Icon name="check" size={13} /></span></div><h3>A few choices.<br />A lot of thinking.</h3><div className="paper-lines"><i /><i /><i /><i /></div><div className="highlight-line" /><div className="paper-lines short"><i /><i /></div><span className="document-page">01 / 04</span></div>
        <div className="conversation-preview"><span className="conversation-label"><Icon name="spark" size={15} /> A MOMENT TO EXPLAIN</span><Wave /><p>“What made you choose<br />this approach?”</p><div className="preview-mic"><Icon name="mic" size={20} /></div></div>
        <div className="floating-note"><span className="small-check"><Icon name="check" size={16} /></span>Let your understanding speak.</div>
        <div className="visual-cross cross-one">+</div><div className="visual-cross cross-two">+</div>
      </div>
    </section>
    <section className="how-section" aria-labelledby="how-title"><div className="how-heading"><span className="eyebrow">LESS GUESSWORK. MORE UNDERSTANDING.</span><h2 id="how-title">A little conversation.<br />A clearer picture.</h2></div><div className="how-steps">
      {[['01', 'file', 'Bring your work', 'Upload your assignment. We find the ideas worth talking about.'], ['02', 'mic', 'Talk it through', 'Answer a few personalized questions, one at a time.'], ['03', 'book', 'Make understanding visible', 'Your teacher reviews the evidence, with your thinking in context.']].map(([n, icon, title, copy]) => <div className="how-step" key={n}><div><span className="icon-tile"><Icon name={icon} /></span><span className="step-number">{n}</span></div><h3>{title}</h3><p>{copy}</p></div>)}
    </div></section>
    <div className="landing-principle"><Icon name="shield" size={22} /><p>Technology asks the questions. <strong>Your teacher makes the judgment.</strong></p></div>
  </div>
}
