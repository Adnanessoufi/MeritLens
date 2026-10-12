import { useState } from 'react'

// The interviewer animation runs locally.
export function useTalkingAvatar(session) {
  const [voiceChoice, setVoiceChoice] = useState(null)
  const questionKey = session ? session.id + ':' + session.question?.id + ':' + session.language : ''
  return {
    status: session?.question ? 'ready' : 'disabled', renderer: 'local-mouth',
    voiceOnly: voiceChoice === questionKey,
    continueWithVoice: () => setVoiceChoice(questionKey),
  }
}
