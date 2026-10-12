import React, { useEffect, useRef, useState } from 'react'
import { createObservationTracker } from '../shared/camera-observations.js'

export function useCameraObservations({ camera, sessionId, questionId, phase, entered, record, meetingMode = false, inhibited = false }) {
  const [state, setState] = useState({ status: 'off' })
  const [handsEnabled, setHandsEnabled] = useState(false)
  const [version, setVersion] = useState(0)
  const refs = useRef({ record, questionId, phase, entered, handsEnabled, meetingMode, inhibited })
  refs.current = { record, questionId, phase, entered, handsEnabled, meetingMode, inhibited }
  const tracker = useRef(null)
  if (!tracker.current) tracker.current = createObservationTracker((type, details) => refs.current.record(type, details))
  useEffect(() => {
    tracker.current.flush()
  }, [questionId, meetingMode ? 'meeting' : phase, entered, handsEnabled, inhibited])
  useEffect(() => {
    if (!camera.ready) { tracker.current.reset(); setState({ status: 'off' }); return }
    let alive = true, ready = false, pending = false, failed = false, frameTimeout, initTimeout, interval, pendingContext
    const video = document.createElement('video')
    video.muted = true; video.playsInline = true; video.srcObject = camera.streamRef.current
    const worker = new Worker('/vision/observer-worker.js')
    setState({ status: 'loading' })
    function fail() {
      if (!alive || failed) return
      failed = true; ready = false; pending = false; tracker.current.flush(); clearTimeout(frameTimeout); clearTimeout(initTimeout); worker.terminate()
      setState({ status: 'unavailable' }); refs.current.record('camera-checks-unavailable', {})
    }
    worker.onerror = fail
    worker.onmessage = ({ data }) => {
      if (!alive || failed) return
      if (data.type === 'ready') { ready = true; clearTimeout(initTimeout); setState({ status: 'calibrating' }); return }
      if (data.type === 'error') { fail(); return }
      if (data.type === 'result') {
        clearTimeout(frameTimeout); pending = false
        const ctx = refs.current
        if (pendingContext !== [ctx.questionId,ctx.meetingMode?'meeting':ctx.phase,ctx.entered,ctx.handsEnabled,ctx.inhibited].join(':')) { tracker.current.flush(); return }
        const snapshot = tracker.current.sample(data, data.timestamp, { questionId: ctx.questionId, phase: ctx.meetingMode ? 'meeting' : ctx.phase, typing: ctx.phase === 'typing', handsEnabled: ctx.handsEnabled, active: ctx.entered && !ctx.inhibited && (ctx.meetingMode || ['answer', 'typing'].includes(ctx.phase)) && !document.hidden })
        setState({ ...snapshot, status: snapshot.calibrated ? 'ready' : 'calibrating' })
      }
    }
    initTimeout = setTimeout(fail, 30000)
    worker.postMessage({ type: 'init' })
    video.play().catch(fail)
    interval = setInterval(async () => {
      if (!alive || failed || !ready || pending || video.readyState < 2) return
      if (document.hidden) { tracker.current.flush(); return }
      pending = true
      try {
        const frame = await createImageBitmap(video)
        if (!alive || failed) { frame.close(); return }
        const ctx = refs.current
        pendingContext = [ctx.questionId,ctx.meetingMode?'meeting':ctx.phase,ctx.entered,ctx.handsEnabled,ctx.inhibited].join(':')
        worker.postMessage({ type: 'frame', frame, timestamp: performance.now(), hands: refs.current.handsEnabled }, [frame])
        frameTimeout = setTimeout(fail, 10000)
      } catch { fail() }
    }, 200)
    return () => { alive = false; clearInterval(interval); clearTimeout(initTimeout); clearTimeout(frameTimeout); tracker.current.reset(); worker.terminate(); video.pause(); video.srcObject = null }
  }, [camera.ready, sessionId, version])
  return { ...state, handsEnabled, setHandsEnabled, recalibrate: () => { tracker.current.recalibrate(); setState(s => ({ ...s, status: 'calibrating', calibrated: false })) }, retry: () => setVersion(v => v + 1) }
}

export function CameraObservations({ observations: o, compact = false }) {
  const warning = o.phoneSeconds >= 3 ? 'Possible phone visible · ' + Math.floor(o.phoneSeconds) + 's' : o.missingSeconds >= 3 ? 'Face not detected · ' + Math.floor(o.missingSeconds) + 's' : o.turnedSeconds >= 3 ? 'Head turned ' + o.direction + ' · ' + Math.floor(o.turnedSeconds) + 's' : null
  return <div className={'camera-observations' + (warning ? ' observation-warning' : '')} aria-label="Camera observations">
    <strong>{compact ? 'Camera checks' : 'Camera observations'}</strong>
    <div className="observation-status" role="status">{o.status === 'off' ? 'Available when the camera is on' : o.status === 'loading' ? 'Loading local camera checks…' : o.status === 'unavailable' ? 'Checks unavailable · your interview still works' : warning || (o.status === 'calibrating' ? (o.face === false ? 'Face not detected · adjust your camera' : 'Look at the screen and hold still for 2 seconds') : o.face === false ? 'Face not detected' : o.direction ? 'Head turned ' + o.direction : 'Face visible · head near starting position')}</div>
    {['ready','calibrating'].includes(o.status) && <div className="observation-actions"><button onClick={o.recalibrate}>Recalibrate</button><label><input type="checkbox" checked={o.handsEnabled} onChange={e => o.setHandsEnabled(e.target.checked)} />Check hands in frame</label></div>}
    {o.phoneReady === false && <small className="phone-check-state">Phone detection unavailable</small>}
    {o.phoneReady === true && <small className="phone-check-state">{o.phone ? 'Possible phone in frame' : 'Phone check active · outside-frame devices cannot be seen'}</small>}
    {o.handsEnabled && <small>{['off','unavailable'].includes(o.status) ? 'Hand check unavailable' : o.hands === null || o.hands === undefined ? 'Loading hand check…' : !o.handsConfirmed ? 'Show both hands for 1 second to confirm framing.' : o.hands === null ? 'Hand tracking unavailable' : o.handSeconds >= 3 ? 'Hands not detected · ' + Math.floor(o.handSeconds) + 's' : o.hands + ' hands visible'}</small>}
    {o.status === 'unavailable' && <button className="text-button" onClick={o.retry}>Retry camera checks</button>}
    <small>{o.handsEnabled ? 'Hands need desk framing; typing is excluded. ' : ''}Local processing · event summaries only. These observations do not affect scores.</small>
  </div>
}
