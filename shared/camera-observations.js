// Visible geometry only. No emotion, concentration, identity, or misconduct inference.
export const OBSERVATION_THRESHOLD_MS = 3000
export function poseFromMatrix(data) {
  if (!data || data.length !== 16 || !Array.from(data).every(Number.isFinite)) return null
  return { yaw: Math.atan2(data[8], data[10]) * 180 / Math.PI, pitch: Math.atan2(-data[9], Math.hypot(data[8], data[10])) * 180 / Math.PI }
}
export function createObservationTracker(emit) {
  let calibration = null, samples = [], last = null, context = null, handSamples = 0, handsConfirmed = false
  let lastMouth=null,mouthMovedAt=null,mouthSamples=0
  const episodes = new Map()
  function finish(key, time) {
    const event = episodes.get(key)
    if (!event) return
    episodes.delete(key)
    const duration = Math.max(0, time - event.start)
    if (duration >= OBSERVATION_THRESHOLD_MS) emit(event.type, { questionId: event.questionId, phase: event.phase, durationSeconds: Math.min(300, Math.round(duration / 1000)), ...(event.direction ? { direction: event.direction } : {}) })
  }
  function flush() { for (const key of [...episodes.keys()]) finish(key, last ?? 0); context = null }
  function episode(key, type, on, time, ctx, direction) {
    const previous = episodes.get(key)
    if (previous && previous.direction !== direction && key!=='head') finish(key, time)
    if(previous&&key==='head'&&on)previous.direction=direction
    if (!on) { finish(key, time); return 0 }
    if (!episodes.has(key)) episodes.set(key, { type, start: time, questionId: ctx.questionId, phase: ctx.phase, direction })
    const value = episodes.get(key)
    const seconds = (time - value.start) / 1000
    if (seconds >= 15) { finish(key, time); episodes.set(key, { ...value, start: time }) }
    return seconds
  }
  return {
    flush,
    reset() { lastMouth=null;mouthMovedAt=null;mouthSamples=0;flush(); calibration = null; samples = []; handsConfirmed = false; handSamples = 0; last = null },
    recalibrate() { flush(); calibration = null; samples = [] },
    sample(result, time, ctx) {
      if (last !== null && time - last > 1500) flush()
      if (context !== ctx.questionId + ':' + ctx.phase + ':' + ctx.active + ':' + ctx.handsEnabled) flush()
      context = ctx.questionId + ':' + ctx.phase + ':' + ctx.active + ':' + ctx.handsEnabled
      last = time
      const face = result.face === true
      const pose = result.pose
      const mouthReady=face&&result.mouth&&Number.isFinite(result.mouth.opening)&&Number.isFinite(result.mouth.stretch)
      if(mouthReady){
        if(!lastMouth||time-lastMouth.time>700){mouthSamples=0;mouthMovedAt=time}
        else if(Math.abs(result.mouth.opening-lastMouth.opening)>=.01||Math.abs(result.mouth.stretch-lastMouth.stretch)>=.018)mouthMovedAt=time
        mouthSamples++;lastMouth={...result.mouth,time}
      }else{lastMouth=null;mouthMovedAt=null;mouthSamples=0}
      const mouthMoving=mouthMovedAt!==null&&time-mouthMovedAt<1200
      if (!calibration && face && pose && Math.abs(pose.yaw) < 30 && Math.abs(pose.pitch) < 30) {
        samples.push(pose); if (samples.length > 10) samples.shift()
        if (samples.length === 10 && Math.max(...samples.map(p => p.yaw)) - Math.min(...samples.map(p => p.yaw)) < 10 && Math.max(...samples.map(p => p.pitch)) - Math.min(...samples.map(p => p.pitch)) < 10) {
          const median = field => [...samples].map(p => p[field]).sort((a,b) => a-b)[5]
          calibration = { yaw: median('yaw'), pitch: median('pitch') }
          emit('camera-calibrated', {})
        }
      } else if (!calibration) samples = []
      if (ctx.handsEnabled && !handsConfirmed) {
        handSamples = result.hands === 2 ? handSamples + 1 : 0
        if (handSamples >= 5) { handsConfirmed = true; emit('hand-check-enabled', {}) }
      }
      if (!ctx.handsEnabled) { handSamples = 0; handsConfirmed = false }
      let direction = null
      if (face && pose && calibration) {
        const yaw = pose.yaw - calibration.yaw, pitch = pose.pitch - calibration.pitch
        if (Math.abs(yaw) > 28) direction = yaw > 0 ? 'left' : 'right'
        else if (Math.abs(pitch) > 22) direction = pitch > 0 ? 'down' : 'up'
      }
      const missingSeconds = episode('face', 'face-missing', ctx.active && !face, time, ctx)
      const turnedSeconds = episode('head', 'head-turned', ctx.active && Boolean(direction), time, ctx, direction)
      const handSeconds = episode('hands', 'hands-out-of-frame', ctx.active && !ctx.typing && ctx.phase !== 'typing' && ctx.handsEnabled && handsConfirmed && result.hands === 0, time, ctx)
      const phoneSeconds = episode('phone', 'phone-visible', ctx.active && result.phone === true, time, ctx)
      return { mouthReady:Boolean(mouthReady&&mouthSamples>=3),mouthMoving,mouthSampleAt:time,phone: result.phone, phoneReady: result.phoneReady, phoneSeconds, face, calibrated: Boolean(calibration), direction, hands: result.hands, handsConfirmed, missingSeconds, turnedSeconds, handSeconds }
    },
  }
}

// Sustained framing warnings share one two-warning budget.
export function cameraWarningCount(meeting={}) {
 return ['face-missing','head-turned','hands-out-of-frame'].reduce((total,type)=>total+(Number(meeting.cameraCounts?.[type])||0),0)
}
