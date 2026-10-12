// A microphone/mouth-activity mismatch is a review signal, never speaker identity.
export const SPEAKER_MISMATCH_SECONDS=3
export function createSpeakerMismatchTracker(){
 let started=null,lastAudio=null
 const reset=()=>{started=null;lastAudio=null}
 return {reset,sample({enabled,level,mouthReady,mouthMoving,face,frameAt},now){
  if(!enabled||!mouthReady||!face||!Number.isFinite(frameAt)||now-frameAt>700||now<frameAt||mouthMoving){reset();return {flag:false,seconds:0}}
  if(level>=.04){if(started===null)started=now;lastAudio=now}
  else if(lastAudio===null||now-lastAudio>300){reset();return {flag:false,seconds:0}}
  const seconds=started===null?0:(now-started)/1000
  return {flag:seconds>=SPEAKER_MISMATCH_SECONDS,seconds}
 }}
}
