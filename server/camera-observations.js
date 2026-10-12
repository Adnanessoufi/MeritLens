import { HttpError } from './extract.js'
export const CAMERA_EVENT_TYPES = ['face-missing', 'head-turned', 'hands-out-of-frame', 'phone-visible', 'camera-checks-unavailable', 'camera-calibrated', 'hand-check-enabled']
export function cameraEventDetails(db, session, type, details = {}) {
  if (!details || typeof details !== 'object' || Array.isArray(details) || Object.keys(details).some(key => !['questionId','phase','durationSeconds','direction'].includes(key))) throw new HttpError(400, 'Send camera event summaries only.')
  if (!['face-missing','head-turned','hands-out-of-frame', 'phone-visible'].includes(type)) {
    if (Object.keys(details).length) throw new HttpError(400, 'This camera event has no response details.')
    return {}
  }
  if (typeof details.questionId !== 'string' || !['answer','typing','meeting'].includes(details.phase) || !Number.isInteger(details.durationSeconds) || details.durationSeconds < 3 || details.durationSeconds > 300) throw new HttpError(400, 'Camera observations need a question, response phase, and duration between 3 and 300 seconds.')
  if (type === 'hands-out-of-frame' && details.phase === 'typing') throw new HttpError(400, 'Hand visibility is not monitored while typing.')
  if (type === 'head-turned' && !['left','right','up','down'].includes(details.direction)) throw new HttpError(400, 'Choose a visible head-turn direction.')
  if (type !== 'head-turned' && details.direction !== undefined) throw new HttpError(400, 'This observation does not have a direction.')
  const answer = db.prepare('SELECT position FROM answers WHERE session_id = ? AND question_id = ?').get(session.id, details.questionId)
  if (!answer && session.current.id !== details.questionId) throw new HttpError(409, 'Camera observation does not belong to a delivered question.')
  const questionNumber = answer?.position || db.prepare('SELECT COUNT(*) AS n FROM answers WHERE session_id = ?').get(session.id).n + 1
  return { questionId: details.questionId, questionNumber, phase: details.phase, durationSeconds: details.durationSeconds, ...(details.direction ? { direction: details.direction } : {}) }
}
