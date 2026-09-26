import { useEffect, useRef, useState } from 'react'
import { api } from './api.js'

export function useVoice({ session, config, onPresented, onEnded, onResume, onTranscript }) {
  const [speaking, setSpeaking] = useState(false)
  const [recording, setRecording] = useState(false)
  const [requestingMicrophone, setRequestingMicrophone] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [error, setError] = useState('')
  const [recordingBlob, setRecordingBlob] = useState(null)
  const controls = useRef({ alive: true, audio: null, url: null, recorder: null, stream: null, recognition: null, playback: 0, watchdog: null })
  const callbacks = useRef({ onPresented, onEnded, onResume, onTranscript })
  callbacks.current = { onPresented, onEnded, onResume, onTranscript }
  const path = `/sessions/${session.id}`
  const questionId = session.question.id

  useEffect(() => () => {
    const state = controls.current
    state.alive = false
    clearTimeout(state.watchdog)
    state.audio?.pause()
    if (state.url) URL.revokeObjectURL(state.url)
    window.speechSynthesis?.cancel()
    state.recognition?.abort()
    if (state.recorder?.state === 'recording') state.recorder.stop()
    state.stream?.getTracks().forEach(track => track.stop())
  }, [])

  async function presented() {
    if (!controls.current.alive) return
    setSpeaking(false)
    clearTimeout(controls.current.watchdog)
    try { await callbacks.current.onPresented() } catch (error) { setError(error.message) }
  }

  function browserSpeak() {
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) throw new Error('Audio is unavailable in this browser. Select See Question to continue.')
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(session.question.text)
    utterance.lang = 'en-US'
    utterance.rate = 0.93
    utterance.onstart = () => clearTimeout(controls.current.watchdog)
    utterance.onend = presented
    utterance.onerror = event => {
      if (!controls.current.alive || ['interrupted', 'canceled'].includes(event.error)) return
      setSpeaking(false)
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

  async function speak() {
    const playback = ++controls.current.playback
    setError('')
    setSpeaking(true)
    try {
      if (config.voice === 'elevenlabs') {
        const state = controls.current
        if (!state.audio) {
          const response = await fetch(`/api${path}/speech`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ questionId }) })
          if (!response.ok) throw new Error((await response.json()).error || 'Voice playback failed.')
          const blob = await response.blob()
          if (!state.alive || playback !== state.playback) return
          state.url = URL.createObjectURL(blob)
          state.audio = new Audio(state.url)
          state.audio.onended = presented
          state.audio.onerror = () => { setSpeaking(false); setError('Audio playback failed. Try Listen Again or See Question.') }
        }
        state.audio.currentTime = 0
        await state.audio.play()
      } else browserSpeak()
    } catch (error) {
      if (!controls.current.alive) return
      setSpeaking(false)
      setError(`${error.message} You can always use See Question.`)
    }
  }

  function stopSpeaking() {
    controls.current.playback++
    clearTimeout(controls.current.watchdog)
    controls.current.audio?.pause()
    window.speechSynthesis?.cancel()
    setSpeaking(false)
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
    } catch (error) { if (controls.current.alive) setError(error.message) }
    finally { if (controls.current.alive) setTranscribing(false) }
  }

  async function startRecording() {
    if (controls.current.requesting) return
    controls.current.requesting = true
    setRequestingMicrophone(true)
    setError('')
    setRecordingBlob(null)
    try {
      await callbacks.current.onPresented()
      await callbacks.current.onResume()
      if (config.voice === 'elevenlabs') {
        if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) throw new Error('Recording is unavailable here. Use a browser with microphone support or type your answer.')
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        if (!controls.current.alive) { stream.getTracks().forEach(track => track.stop()); return }
        controls.current.stream = stream
        const mimeType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find(type => MediaRecorder.isTypeSupported(type))
        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
        controls.current.recorder = recorder
        const chunks = []
        recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data) }
        recorder.onstop = async () => {
          stream.getTracks().forEach(track => track.stop())
          if (!controls.current.alive) return
          setRecording(false)
          const blob = new Blob(chunks, { type: recorder.mimeType })
          setRecordingBlob(blob)
          try { await callbacks.current.onEnded(); await transcribe(blob) } catch (error) { setError(error.message) }
        }
        recorder.start()
        setRecording(true)
      } else {
        const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition
        if (!Recognition) throw new Error('Browser dictation is unavailable. Type your answer, or configure ElevenLabs for recorded voice.')
        const recognition = new Recognition()
        controls.current.recognition = recognition
        recognition.lang = 'en-US'
        recognition.continuous = true
        recognition.interimResults = true
        let transcript = ''
        recognition.onresult = event => {
          transcript = Array.from(event.results).map(r => r[0].transcript).join(' ')
          if (controls.current.alive) callbacks.current.onTranscript(transcript)
        }
        recognition.onerror = event => {
          if (controls.current.alive && event.error !== 'aborted') setError(event.error === 'not-allowed' ? 'Microphone access was denied. Allow it in your browser, or type your answer.' : 'Dictation stopped. Please check your microphone or type your answer.')
        }
        recognition.onend = async () => {
          if (!controls.current.alive) return
          setRecording(false)
          if (transcript.trim()) {
            try { await callbacks.current.onEnded() } catch (error) { setError(error.message) }
          }
        }
        recognition.start()
        setRecording(true)
      }
    } catch (error) {
      controls.current.stream?.getTracks().forEach(track => track.stop())
      if (!controls.current.alive) return
      setRecording(false)
      setError(error.name === 'NotAllowedError' ? 'Microphone access was denied. Allow it in your browser, or type your answer.' : error.message)
    } finally {
      controls.current.requesting = false
      if (controls.current.alive) setRequestingMicrophone(false)
    }
  }

  function stopRecording() {
    const state = controls.current
    if (state.recorder?.state === 'recording') state.recorder.stop()
    state.recognition?.stop()
  }
  // Bound a recording even when a student leaves the tab open after the question timer.
  useEffect(() => {
    if (!recording) return
    const timeout = setTimeout(stopRecording, 120000)
    return () => clearTimeout(timeout)
  }, [recording])

  return { speaking, recording, requestingMicrophone, transcribing, error, speak, stopSpeaking, startRecording, stopRecording,
    retryTranscription: recordingBlob ? () => transcribe(recordingBlob) : null }
}
