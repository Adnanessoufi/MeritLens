import React from 'react'
import LipPortrait from './LipPortrait.jsx'
import { Wave } from './components.jsx'

export default function Interviewer({ avatar, speaking = false, loadingSpeech = false, recording = false, transcribing = false, busy = false, lipLevel, lipPose }) {
  const preparing = loadingSpeech
  const state = busy ? 'thinking' : preparing ? 'preparing' : speaking ? 'speaking' : recording ? 'listening' : transcribing ? 'transcribing' : 'ready'
  const local = avatar?.renderer === 'local-mouth' && !avatar.voiceOnly
  return <div className={'interviewer interviewer-' + state + (local ? ' interviewer-local' : '')} data-state={state}>
    <div className="interviewer-portrait">
      <img src="/assets/adnane-interviewer.jpg" alt="Adnane, portrait for the AI interviewer" />
      {local && <LipPortrait level={lipLevel} pose={lipPose} speaking={speaking&&!loadingSpeech} listening={recording} />}
      <span className="interviewer-status"><i />{preparing ? 'Preparing audio' : speaking ? 'Speaking' : recording ? 'Listening' : busy ? 'Preparing next question' : transcribing ? 'Transcribing' : 'Ready'}</span>
    </div>
    <div className="interviewer-copy"><span className="eyebrow">ADNANE · AI INTERVIEWER</span><h1 className="voice-title">{busy ? 'Taking in your thinking…' : preparing ? 'Getting your question ready.' : speaking ? 'A question for you.' : recording ? 'We’re listening.' : transcribing ? 'Putting your words on paper…' : 'Your turn to share.'}</h1><p className="voice-caption" role="status">{preparing ? 'Your timer waits until the question finishes.' : speaking ? 'Listen, then tell us what you think.' : recording ? 'Speak naturally. Tap the microphone when you’re done.' : transcribing ? 'Review the transcript before sending.' : 'Explain your reasoning in your own words.'}</p><div className="interviewer-wave" aria-hidden="true"><Wave active={speaking || recording} /></div></div>
  </div>
}
