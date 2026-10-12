import { useEffect, useRef, useState } from 'react'
import { api } from './api.js'
import { MAX_RECORDING_SECONDS } from '../shared/timer.js'

export function useVoice({ session, config, avatar, onPresented, onEnded, onResume, onTranscript, onNoSpeech }) {
  const [speaking, setSpeaking] = useState(false)
  const [loadingSpeech,setLoadingSpeech]=useState(false)
  const lipLevel = useRef(0)
  const lipPose=useRef({roundness:0})
  const [recording, setRecording] = useState(false)
  const [requestingMicrophone, setRequestingMicrophone] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [error, setError] = useState('')
  const [recordingBlob, setRecordingBlob] = useState(null)
  const [level, setLevel] = useState(0)
  const controls = useRef({ alive: true, audio: null, url: null, recorder: null, stream: null, recognition: null, playback: 0, watchdog: null })
  const callbacks = useRef({ onPresented, onEnded, onResume, onTranscript, onNoSpeech })
  callbacks.current = { onPresented, onEnded, onResume, onTranscript, onNoSpeech }
  const path = `/sessions/${session.id}`
  const questionId = session.question.id

  useEffect(() => () => {
    const state = controls.current
    state.alive = false
    clearTimeout(state.watchdog)
    stopMeter()
    stopLipMeter()
    state.lipContext?.close().catch(() => {})
    state.audio?.pause()
    if (state.url) URL.revokeObjectURL(state.url)
    window.speechSynthesis?.cancel()
    state.recognition?.abort()
    if (state.recorder?.state === 'recording') state.recorder.stop()
    state.stream?.getTracks().forEach(track => track.stop())
  }, [])

  function stopMeter() {
    const state = controls.current
    if (state.meterFrame) cancelAnimationFrame(state.meterFrame)
    state.meterFrame = null
    if (state.meter?.state !== 'closed') state.meter?.close().catch(() => {})
    state.meter = null
    if (state.alive) setLevel(0)
  }
  function startMeter(stream) {
    stopMeter()
    const Context = window.AudioContext || window.webkitAudioContext
    if (!Context) return
    try {
      const context = new Context()
      controls.current.meter = context
      controls.current.speechSamples=0; controls.current.speechFrames=0
      context.resume().catch(() => {})
      const analyser = context.createAnalyser()
      analyser.fftSize = 256
      context.createMediaStreamSource(stream).connect(analyser)
      const values = new Uint8Array(analyser.fftSize)
      let previous = 0
      const update = timestamp => {
        if (!controls.current.alive || controls.current.meter !== context) return
        if (timestamp - previous > 80) {
          previous = timestamp; analyser.getByteTimeDomainData(values)
          const rms = Math.sqrt(values.reduce((sum, value) => sum + ((value - 128) / 128) ** 2, 0) / values.length)
          controls.current.speechSamples++;if(rms>=.004)controls.current.speechFrames++
          setLevel(Math.min(1, rms * 5))
        }
        controls.current.meterFrame = requestAnimationFrame(update)
      }
      controls.current.meterFrame = requestAnimationFrame(update)
    } catch { stopMeter() }
  }

  function stopLipMeter() {
    const state = controls.current
    cancelAnimationFrame(state.lipFrame)
    state.lipFrame = null; lipLevel.current = 0; lipPose.current={roundness:0}
  }
  function startLipMeter(audio) {
    stopLipMeter()
    if (avatar?.renderer !== 'local-mouth' || avatar.voiceOnly) return
    const state = controls.current, Context = window.AudioContext || window.webkitAudioContext
    if (!Context) return
    try {
      if(state.lipAudio&&state.lipAudio!==audio){state.lipContext?.close().catch(()=>{});state.lipContext=null}
      if (!state.lipContext) {
        const context = new Context(), analyser = context.createAnalyser()
        analyser.fftSize = 512
        context.createMediaElementSource(audio).connect(analyser)
        analyser.connect(context.destination)
        state.lipContext = context; state.lipAnalyser = analyser; state.lipAudio=audio
      }
      state.lipContext.resume().catch(() => {})
      const values = new Uint8Array(state.lipAnalyser.fftSize)
      const spectrum=new Uint8Array(state.lipAnalyser.frequencyBinCount)
      let peak=.05
      const update = () => {
        if (!state.alive || audio.paused || audio.ended) { stopLipMeter(); return }
        state.lipAnalyser.getByteTimeDomainData(values)
        const rms = Math.sqrt(values.reduce((sum,v) => sum + ((v-128)/128)**2, 0)/values.length)
        peak=Math.max(.035,rms,peak*.985)
        const target = rms < .006 ? 0 : Math.min(.95,Math.pow(rms/peak,.75)*.95)
        state.lipAnalyser.getByteFrequencyData(spectrum)
        const low=spectrum.slice(1,12).reduce((a,b)=>a+b,0),high=spectrum.slice(12,70).reduce((a,b)=>a+b,0)
        const shape=low/(low+high+1)
        lipPose.current={roundness:(lipPose.current.roundness||0)*.55+shape*.45}
        lipLevel.current = lipLevel.current * .25 + target * .75
        state.lipFrame = requestAnimationFrame(update)
      }
      state.lipFrame = requestAnimationFrame(update)
    } catch { lipLevel.current = 0 }
  }

  async function presented() {
    if (!controls.current.alive) return
    setSpeaking(false)
    setLoadingSpeech(false)
    controls.current.hasPresented=true
    stopLipMeter()
    clearTimeout(controls.current.watchdog)
    try { await callbacks.current.onPresented() } catch (error) { setError(error.message) }
  }

  function browserSpeak() {
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) throw new Error('Audio is unavailable in this browser. Select See Question to continue.')
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(session.meeting?.enabled&&!controls.current.hasPresented?session.spokenQuestionText||session.question.text:session.question.text)
    utterance.lang = { en: 'en-US', fr: 'fr-FR', ar: 'ar-SA', hu:'hu-HU' }[session.language] || 'en-US'
    utterance.rate = 0.93
    utterance.onstart = () => {
      clearTimeout(controls.current.watchdog)
      setLoadingSpeech(false)
      if(avatar?.renderer==='local-mouth'&&!avatar.voiceOnly){
        const began=performance.now()
        const move=now=>{
          if(!controls.current.alive||controls.current.utterance!==utterance)return
          const t=(now-began)/1000
          // Native browser speech exposes no waveform; cadence is approximate.
          lipLevel.current=.2+.6*Math.pow(Math.sin(t*12),2)
          lipPose.current={roundness:.5+.4*Math.sin(t*5)}
          controls.current.lipFrame=requestAnimationFrame(move)
        }
        controls.current.lipFrame=requestAnimationFrame(move)
      }
    }
    utterance.onend = presented
    utterance.onerror = event => {
      if (!controls.current.alive || ['interrupted', 'canceled'].includes(event.error)) return
      setSpeaking(false)
      setLoadingSpeech(false)
      stopLipMeter()
      setError('Audio could not play. Select Listen Again, or See Question to continue.')
    }
    controls.current.utterance = utterance
    window.speechSynthesis.speak(utterance)
    controls.current.watchdog = setTimeout(() => {
      if (!controls.current.alive) return
      stopSpeaking()
      setError('Your browser has not started audio. Try Listen Again or See Question.')
    }, 8000)
  }

  async function speakFeedback(text) {
    stopSpeaking()
    const state=controls.current
    setSpeaking(true);setLoadingSpeech(true)
    try {
      if(config.voice==='browser') {
        await new Promise(resolve=>{
          const utterance=new SpeechSynthesisUtterance(text)
          utterance.lang={en:'en-US',fr:'fr-FR',ar:'ar-SA',hu:'hu-HU'}[session.language]||'en-US'
          utterance.rate=.93;utterance.onstart=()=>setLoadingSpeech(false)
          const timeout=setTimeout(()=>{window.speechSynthesis.cancel();resolve()},20000)
          utterance.onend=utterance.onerror=()=>{clearTimeout(timeout);resolve()}
          window.speechSynthesis.speak(utterance)
        })
      } else {
        const response=await fetch(`/api${path}/speech`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({questionId,feedback:true}),signal:AbortSignal.timeout(15000)})
        if(!response.ok)throw new Error('Feedback audio unavailable.')
        const blob=await response.blob()
        if(!state.alive)return
        if(state.url)URL.revokeObjectURL(state.url)
        state.url=URL.createObjectURL(blob);state.audio=new Audio(state.url)
        await new Promise(resolve=>{
          const timeout=setTimeout(()=>{state.audio.pause();resolve()},20000)
          state.audio.onended=state.audio.onerror=()=>{clearTimeout(timeout);resolve()}
          state.audio.play().then(()=>{setLoadingSpeech(false);startLipMeter(state.audio)}).catch(()=>{clearTimeout(timeout);resolve()})
        })
      }
    } catch { /* Saved feedback remains visible on completion if audio is unavailable. */ }
    finally {stopLipMeter();if(state.alive){setSpeaking(false);setLoadingSpeech(false)}}
  }

  async function speak() {
    const playback = ++controls.current.playback
    stopLipMeter()
    controls.current.audio?.pause()
    window.speechSynthesis?.cancel()
    setError('')
    setSpeaking(true)
    setLoadingSpeech(true)
    try {
      if (config.voice !== 'browser') {
        const state = controls.current
        const questionOnly=Boolean(session.meeting?.enabled&&state.hasPresented)
        if (!state.audio||questionOnly!==Boolean(state.questionOnlyAudio)) {
          const response = await fetch(`/api${path}/speech`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ questionId,questionOnly }) })
          if (!response.ok) throw new Error((await response.json()).error || 'Voice playback failed.')
          const blob = await response.blob()
          if (!state.alive || playback !== state.playback) return
          if(state.url)URL.revokeObjectURL(state.url)
          state.questionOnlyAudio=questionOnly
          state.url = URL.createObjectURL(blob)
          state.audio = new Audio(state.url)
          state.audio.onended = presented
          state.audio.onerror = () => { stopLipMeter(); setSpeaking(false); setLoadingSpeech(false); setError('Audio playback failed. Try Listen Again or See Question.') }
        }
        state.audio.currentTime = 0
        await state.audio.play()
        setLoadingSpeech(false)
        startLipMeter(state.audio)
      } else browserSpeak()
    } catch (error) {
      if (!controls.current.alive || playback !== controls.current.playback) return
      setSpeaking(false)
      setLoadingSpeech(false)
      stopLipMeter()
      clearTimeout(controls.current.watchdog)
      setError(`${error.message} You can always use See Question.`)
    }
  }

  function stopSpeaking() {
    controls.current.playback++
    clearTimeout(controls.current.watchdog)
    controls.current.audio?.pause()
    window.speechSynthesis?.cancel()
    setSpeaking(false)
    setLoadingSpeech(false)
    stopLipMeter()
  }

  async function transcribe(blob) {
    setTranscribing(true)
    setError('')
    try {
      const form = new FormData()
      form.append('questionId', questionId)
      form.append('audio', blob, blob.type.includes('mp4') ? 'answer.mp4' : 'answer.webm')
      const result = await api(`${path}/transcribe`, { method: 'POST', body: form })
      if (controls.current.alive) callbacks.current.onTranscript(result.text)
    } catch (error) { if (controls.current.alive) { if(/No speech was heard/i.test(error.message))callbacks.current.onNoSpeech?.();else setError(error.message) } }
    finally { if (controls.current.alive) setTranscribing(false) }
  }

  async function startRecording() {
    if (controls.current.requesting) return
    controls.current.requesting = true
    const micRequest=controls.current.micRequest=(controls.current.micRequest||0)+1
    setRequestingMicrophone(true)
    setError('')
    setRecordingBlob(null)
    try {
      await callbacks.current.onPresented()
      await callbacks.current.onResume()
      if(micRequest!==controls.current.micRequest)return
      if (config.voice !== 'browser') {
        if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) throw new Error('Recording is unavailable here. Use a browser with microphone support or type your answer.')
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        if (!controls.current.alive || micRequest!==controls.current.micRequest) { stream.getTracks().forEach(track => track.stop()); return }
        controls.current.stream = stream
        startMeter(stream)
        const mimeType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find(type => MediaRecorder.isTypeSupported(type))
        const recordingRun={interrupted:false};controls.current.recordingRun=recordingRun
        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
        controls.current.recorder = recorder
        const chunks = []
        recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data) }
        recorder.onstop = async () => {
          setTranscribing(true)
          const silent=controls.current.speechSamples>=4&&controls.current.speechFrames===0
          stream.getTracks().forEach(track => track.stop())
          stopMeter()
          if (!controls.current.alive) return
          setRecording(false)
          const blob = new Blob(chunks, { type: recorder.mimeType })
          setRecordingBlob(blob)
          try { if(!recordingRun.interrupted)await callbacks.current.onEnded(); if(silent){setTranscribing(false);if(!recordingRun.interrupted)callbacks.current.onNoSpeech?.()}else await transcribe(blob) } catch (error) { setError(error.message) }
        }
        recorder.start()
        setRecording(true)
      } else {
        const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition
        if (!Recognition) throw new Error('Browser dictation is unavailable. Type your answer, or configure ElevenLabs for recorded voice.')
        const recordingRun={interrupted:false};controls.current.recordingRun=recordingRun
        let browserStream=null
        try{browserStream=await navigator.mediaDevices?.getUserMedia({audio:true});if(browserStream){if(!controls.current.alive||micRequest!==controls.current.micRequest){browserStream.getTracks().forEach(t=>t.stop());return}controls.current.stream=browserStream;startMeter(browserStream)}}catch{ /* Browser dictation can still work when a separate audio meter is unavailable. */ }
        const recognition = new Recognition()
        controls.current.recognition = recognition
        recognition.lang = { en: 'en-US', fr: 'fr-FR', ar: 'ar-SA', hu:'hu-HU' }[session.language] || 'en-US'
        recognition.continuous = true
        recognition.interimResults = true
        let transcript = ''
        recognition.onresult = event => {
          transcript = Array.from(event.results).map(r => r[0].transcript).join(' ')
          if (controls.current.alive) callbacks.current.onTranscript(transcript)
        }
        recognition.onerror = event => {
          if(event.error==='no-speech'){return}
          if (controls.current.alive && event.error !== 'aborted') setError(event.error === 'not-allowed' ? 'Microphone access was denied. Allow it in your browser, or type your answer.' : 'Dictation stopped. Please check your microphone or type your answer.')
        }
        recognition.onend = async () => {
          if (!controls.current.alive) return
          browserStream?.getTracks().forEach(t=>t.stop());stopMeter()
          setRecording(false)
          if (transcript.trim()) {
            try { if(!recordingRun.interrupted)await callbacks.current.onEnded() } catch (error) { setError(error.message) }
          }
          if(!transcript.trim()&&!recordingRun.interrupted){try{await callbacks.current.onEnded();callbacks.current.onNoSpeech?.()}catch(error){setError(error.message)}}
          setTranscribing(false)
        }
        recognition.start()
        setRecording(true)
      }
    } catch (error) {
      controls.current.stream?.getTracks().forEach(track => track.stop())
      stopMeter()
      if (!controls.current.alive) return
      setRecording(false)
      setError(error.name === 'NotAllowedError' ? 'Microphone access was denied. Allow it in your browser, or type your answer.' : error.message)
    } finally {
      if(micRequest===controls.current.micRequest){controls.current.requesting = false; if (controls.current.alive) setRequestingMicrophone(false)}
    }
  }

  function stopRecording(options={}) {
    const state = controls.current
    if(options?.interrupted&&state.recordingRun)state.recordingRun.interrupted=true
    state.micRequest=(state.micRequest||0)+1;state.requesting=false;setRequestingMicrophone(false)
    if (state.recorder?.state === 'recording') { setTranscribing(true); state.recorder.stop() }
    if(state.recognition && recording){setTranscribing(true);state.recognition.stop()}
  }
  // Bound a recording even when a student leaves the tab open after the question timer.
  useEffect(() => {
    if (!recording) return
    const timeout = setTimeout(stopRecording, MAX_RECORDING_SECONDS * 1000)
    return () => clearTimeout(timeout)
  }, [recording])

  return { speaking, loadingSpeech, lipLevel, lipPose, recording, level, requestingMicrophone, transcribing, error, speak, speakFeedback, stopSpeaking, startRecording, stopRecording,
    retryTranscription: recordingBlob ? () => transcribe(recordingBlob) : null }
}
