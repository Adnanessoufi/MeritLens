import React, { useCallback, useEffect, useRef, useState } from 'react'
import { CameraObservations } from './CameraObservations.jsx'
import { Button, ErrorNotice, Icon } from './components.jsx'

// Device readiness is a browser check, not identity verification or grading evidence.
export function useInterviewCamera(sessionId, record) {
  const key = 'merit-lens-camera-exception:' + sessionId
  const [status, setStatus] = useState('idle')
  const [exception, setException] = useState(() => sessionStorage.getItem(key) === 'unavailable')
  const [error, setError] = useState('')
  const media = useRef(null)
  const videos = useRef(new Set())
  const alive = useRef(true)
  const requesting = useRef(false)
  const generation = useRef(0)
  const recorder = useRef(record)
  recorder.current = record
  function stop() {
    media.current?.getTracks().forEach(track => { track.onended = null; track.stop() })
    media.current = null
    for (const node of videos.current) node.srcObject = null
  }
  useEffect(() => { alive.current = true; return () => { alive.current = false; generation.current++; stop() } }, [sessionId])
  const attach = useCallback(node => {
    if (!node) return
    videos.current.add(node)
    if (media.current) { node.srcObject = media.current; node.play().catch(() => {}) }
    return () => { videos.current.delete(node); node.srcObject = null }
  }, [])
  async function enable() {
    if (requesting.current) return
    requesting.current = true
    const request = ++generation.current
    setStatus('requesting'); setError('')
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('This browser cannot access a camera. Try Chrome or use the unavailable-camera option.')
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false })
      if (!alive.current || request !== generation.current) { stream.getTracks().forEach(track => track.stop()); return }
      if (!stream.getVideoTracks().some(track => track.readyState === 'live')) { stream.getTracks().forEach(track => track.stop()); throw new Error('The camera did not start. Reconnect it and try again.') }
      stop(); media.current = stream
      for (const track of stream.getVideoTracks()) track.onended = () => {
        if (!alive.current || media.current !== stream) return
        stop(); setStatus('disconnected'); setException(false)
        sessionStorage.removeItem(key)
        setError('Camera connection lost. Reconnect it to continue, or use the unavailable-camera option.')
        recorder.current('camera-off')
      }
      for (const node of videos.current) {
        node.srcObject = stream
        let timeout
        try { await Promise.race([node.play(), new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('Camera preview did not start. Retry or use the unavailable-camera option.')), 5000) })]) } finally { clearTimeout(timeout) }
      }
      if (!alive.current || media.current !== stream) return
      setStatus('ready'); setException(false); sessionStorage.removeItem(key)
      recorder.current('camera-on')
    } catch (e) {
      if (request !== generation.current) return
      stop()
      if (!alive.current) return
      setStatus('unavailable')
      setError(e.name === 'NotAllowedError' ? 'Camera permission was denied. Allow access in your browser and retry, or use the unavailable-camera option.' : e.name === 'NotFoundError' ? 'No camera was found on this device. Connect one or use the unavailable-camera option.' : e.name === 'NotReadableError' ? 'The camera is busy or unavailable. Close other camera apps and retry.' : e.message)
    } finally { if (request === generation.current) requesting.current = false }
  }
  function continueWithoutCamera() {
    generation.current++; requesting.current = false
    const wasReady = status === 'ready'
    stop(); setStatus('unavailable'); setException(true); setError('')
    sessionStorage.setItem(key, 'unavailable')
    if (wasReady) recorder.current('camera-off')
    recorder.current('camera-exception')
  }
  return { release: () => { stop(); setStatus('idle') }, streamRef: media, status, error, exception, attach, enable, continueWithoutCamera,
    canProceed: status === 'ready' || exception, ready: status === 'ready', starting: status === 'requesting' }
}

export function CameraPreview({ camera }) {
  const video = useRef(null)
  useEffect(() => camera.attach(video.current), [camera.attach])
  return <div className={'camera-preview ' + (camera.ready ? 'camera-active' : '')}><video ref={video} muted playsInline autoPlay aria-label="Your local camera preview" />{!camera.ready && <div className="camera-placeholder"><Icon name="camera" size={30} /><span>{camera.exception ? 'Continuing without camera' : camera.starting ? 'Connecting camera…' : 'Camera required'}</span></div>}{camera.ready && <span className="camera-live"><i />Camera on · local preview</span>}</div>
}

export function CameraSetup({ camera, observations }) {
  if(camera.exception)return <section className="camera-setup camera-setup-exception"><Icon name="camera" size={24}/><div><strong>Camera off · demo fallback</strong><p>Face and camera checks are unavailable.</p><button className="text-button" onClick={camera.enable}>Use camera instead</button></div></section>
  return <section className="camera-setup"><CameraPreview camera={camera} /><div className="camera-setup-copy"><strong>{camera.ready ? 'Camera ready' : camera.exception ? 'Camera exception selected' : 'Turn on your camera to continue'}</strong><details className="data-details"><summary>Camera privacy</summary><p>Video stays on this device. Your teacher receives observation summaries; images and video are not recorded.</p></details>{!camera.ready && <Button variant="white" onClick={camera.enable} loading={camera.starting} disabled={camera.starting}>{camera.status === 'idle' ? 'Enable camera' : 'Retry camera'}</Button>}<ErrorNotice message={camera.error} />{observations && camera.ready && <CameraObservations observations={observations} compact />}<details className="camera-exception"><summary>Camera unavailable?</summary><p>No camera, blocked access, or testing this demo? You can continue. Your teacher sees that the camera was unavailable; it does not change your understanding score.</p><button className="text-button" onClick={camera.continueWithoutCamera} disabled={camera.exception}>Continue without camera</button></details></div></section>
}
