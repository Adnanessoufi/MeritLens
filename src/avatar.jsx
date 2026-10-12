import { useState } from 'react'

// Default avatar is local: no image upload, D-ID request, credit or render wait.
export function useTalkingAvatar(session) {
  const [voiceChoice, setVoiceChoice] = useState(null)
  const questionKey = session ? session.id + ':' + session.question?.id + ':' + session.language : ''
  return {
    status: session?.question ? 'ready' : 'disabled', renderer: 'local-mouth',
    voiceOnly: voiceChoice === questionKey,
    retry() {}, continueWithVoice: () => setVoiceChoice(questionKey),
  }
}
export function AvatarSetup() { return null }
