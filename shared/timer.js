export const QUESTION_DURATION_SECONDS = 45
export const MAX_RECORDING_SECONDS = 300
export const RESPONSE_TIME_OPTIONS = [20, 30, 45, 60, 90, 120, 180, 300]

export function withQuestionTiming(question, mode, fixedDuration = QUESTION_DURATION_SECONDS) {
  if (mode !== 'adaptive') return question
  const words = (question.originalText || question.text || '').trim().split(/\s+/u).length
  let durationSeconds = words > 25 ? 45 : 30
  let timingReason = words > 25 ? 'A longer reasoning question' : 'A focused explanation'
  if (question.stage === 'explain') {
    durationSeconds = words > 45 ? 45 : 30
    timingReason = 'Explain one original choice'
  } else if (question.stage === 'apply') {
    const detailed = question.pairSpec?.changeType === 'bug' || words > 65
    durationSeconds = detailed ? 60 : 45
    timingReason = detailed ? 'Work through a bug or several linked steps' : 'Apply the idea to one changed condition'
  } else if (question.source === 'adaptive') {
    durationSeconds = words > 20 ? 30 : 20
    timingReason = 'A focused follow-up'
  }
  return { ...question, durationSeconds, timingReason }
}
