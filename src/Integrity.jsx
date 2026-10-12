import React, { useEffect, useRef, useState } from 'react'
import { api, useResource } from './api.js'
import { Button, ErrorNotice, Icon, Badge } from './components.jsx'
import { CameraObservations } from './CameraObservations.jsx'
import { CameraPreview } from './Camera.jsx'

export function useInterviewSignals(sessionId, capturing = true) {
  const resource = useResource('/sessions/' + sessionId + '/activity')
  const [error, setError] = useState('')
  const active = useRef(true)
  const queue = useRef(Promise.resolve())
  function record(type, details) {
    const eventId = crypto.randomUUID()
    queue.current = queue.current.catch(() => {}).then(async () => {
      try {
        const data = await api('/sessions/' + sessionId + '/activity', { method: 'POST', body: { eventId, type, ...(details ? { details } : {}) }, keepalive: true })
        if (active.current) { resource.setData(data); setError('') }
      } catch { if (active.current) setError('Focus signals could not be saved. Your interview and answers still work.') }
    })
  }
  useEffect(() => {
    active.current = true
    if (!capturing) return () => { active.current = false }
    record('interview-start')
    const visibility = () => record(document.hidden ? 'page-hidden' : 'page-visible')
    const blur = () => record('window-blur')
    const focus = () => record('window-focus')
    document.addEventListener('visibilitychange', visibility)
    window.addEventListener('blur', blur)
    window.addEventListener('focus', focus)
    return () => { active.current = false; document.removeEventListener('visibilitychange', visibility); window.removeEventListener('blur', blur); window.removeEventListener('focus', focus) }
  }, [sessionId, capturing])
  return { data: resource.data, error: error || resource.error, record }
}

export function InterviewTools({ signals, camera, observations }) {
  return <aside className="interview-tools"><section className="panel camera-card"><div className="tool-heading"><Icon name="camera" size={19} /><strong>You</strong><span className={'camera-state ' + (camera.ready ? 'is-on' : '')}>{camera.ready ? 'Camera on' : 'Camera unavailable'}</span></div><CameraPreview camera={camera} /><CameraObservations observations={observations} compact />{camera.exception && <><p className="camera-exception-note">Camera exception · visible to your teacher</p><Button className="full" variant="white" onClick={camera.enable} loading={camera.starting}>Retry camera</Button><ErrorNotice message={camera.error} /></>}<p>Local preview only. No video or images are stored.</p></section><section className="panel focus-card"><div className="tool-heading"><Icon name="shield" size={19} /><strong>Interview focus</strong></div><div className="focus-number"><strong>{signals.data?.tabAwayCount || 0}</strong><span>times this tab was left</span></div><p>Visibility and focus changes are shared as context. Other tabs and browsing history stay private.</p><ErrorNotice message={signals.error} /></section><div className="interview-reassurance"><Icon name="book" size={18} /><p>Your teacher reviews your reasoning.<br /><strong>Camera and timing do not affect your understanding score.</strong></p></div></aside>
}

const eventNames = { 'meeting-speaker-warning':'Audio and mouth movement mismatch', 'interview-start': 'Interview opened', 'page-hidden': 'Interview tab left', 'page-visible': 'Interview tab returned', 'window-blur': 'Window lost focus', 'window-focus': 'Window regained focus', 'camera-on': 'Local camera preview enabled', 'camera-off': 'Camera disconnected', 'camera-exception': 'Unavailable camera · student used fallback', 'face-missing': 'Face not detected', 'phone-visible': 'Possible phone detected in camera', 'head-turned': 'Head turned', 'hands-out-of-frame': 'Hands not detected in frame', 'camera-calibrated': 'Camera position calibrated', 'hand-check-enabled': 'Hand framing confirmed', 'camera-checks-unavailable': 'Local camera checks unavailable', 'meeting-tab-warning':'Meeting tab warning', 'meeting-camera-warning':'Camera framing reminder', 'meeting-held':'Meeting stopped for human review', 'meeting-resumed':'Teacher allowed meeting to resume', 'meeting-ended':'Teacher closed the attempt', 'answer-timeout':'Response window ended' }
export function ActivityEvidence({ activity }) {
  if (!activity) return null
  const camera=activity.cameraObservations||{}
  const events=activity.events||[]
  const speakerWarnings=events.filter(e=>e.type==='meeting-speaker-warning').length
  const reminders=events.filter(e=>e.type==='meeting-camera-warning').length
  const phoneFlags=Math.max(events.filter(e=>e.type==='phone-visible').length,events.filter(e=>e.type==='meeting-held'&&e.details?.reason==='Possible phone detected in camera').length)
  return <section className="panel activity-evidence compact-session-activity">
   <h2>Interview activity</h2><p className="small muted">Session events only. These do not change the grade.</p>
   <dl className="session-activity-rows">
    <div><dt>Tab departures</dt><dd>{activity.tabAwayCount||0}</dd></div>
    <div><dt>Time outside tab</dt><dd>{activity.hiddenSeconds||0}s</dd></div>
    <div><dt>Camera</dt><dd>{activity.cameraException?'Unavailable':activity.cameraEnabled?'Used':'Not used'}</dd></div>
    {speakerWarnings>0&&<div><dt>Speaker check warnings</dt><dd>{speakerWarnings}</dd></div>}
    {reminders>0&&<div><dt>Camera reminders</dt><dd>{reminders}</dd></div>}
    {camera.headTurnedSeconds>0&&<div><dt>Head turned</dt><dd>{camera.headTurnedSeconds}s</dd></div>}
    {camera.faceMissingSeconds>0&&<div><dt>Face not detected</dt><dd>{camera.faceMissingSeconds}s</dd></div>}
    {phoneFlags>0&&<div><dt>Possible phone detections</dt><dd>{phoneFlags}</dd></div>}
   </dl>
   {events.length>0&&<details className="activity-timeline"><summary>Event timeline <span>{events.length} events</span></summary><p className="small muted">Window focus can change without leaving the tab. Camera means it was used during this interview.</p>{events.map(e=><div key={e.id}><time>{new Date(e.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</time><span>{eventNames[e.type]||e.type}{e.details?.durationSeconds?' · '+e.details.durationSeconds+'s':''}{e.details?.direction?' · '+e.details.direction:''}{e.details?.reason?' · '+e.details.reason:''}</span></div>)}</details>}
  </section>
}
