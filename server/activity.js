export function activityView(db, sessionId) {
  const events = db.prepare('SELECT id, type, created_at, details FROM activity_events WHERE session_id = ? ORDER BY created_at, rowid').all(sessionId).map(event => ({ ...event, details: JSON.parse(event.details || '{}') }))
  const session = db.prepare('SELECT status, completed_at FROM sessions WHERE id = ?').get(sessionId)
  let hiddenSince = null
  let hiddenSeconds = 0
  let tabAwayCount = 0
  for (const event of events) {
    if (event.type === 'page-hidden' && hiddenSince === null) { hiddenSince = Date.parse(event.created_at); tabAwayCount++ }
    if (event.type === 'page-visible' && hiddenSince !== null) { hiddenSeconds += Math.max(0, (Date.parse(event.created_at) - hiddenSince) / 1000); hiddenSince = null }
  }
  if (hiddenSince !== null) hiddenSeconds += Math.max(0, ((session.completed_at ? Date.parse(session.completed_at) : Date.now()) - hiddenSince) / 1000)
  const cameraEvents = events.filter(e => ['face-missing','head-turned','hands-out-of-frame','phone-visible'].includes(e.type))
  const seconds = type => cameraEvents.filter(e => e.type === type).reduce((sum,e) => sum + (e.details.durationSeconds || 0), 0)
  return { cameraObservations: { calibrated: events.some(e => e.type === 'camera-calibrated'), handsEnabled: events.some(e => e.type === 'hand-check-enabled'), unavailable: events.some(e => e.type === 'camera-checks-unavailable'), count: cameraEvents.length, phoneVisibleSeconds: seconds('phone-visible'), faceMissingSeconds: seconds('face-missing'), headTurnedSeconds: seconds('head-turned'), handsNotVisibleSeconds: seconds('hands-out-of-frame') }, events, tabAwayCount, hiddenSeconds: Math.round(hiddenSeconds), focusChanges: events.filter(e => e.type === 'window-blur').length,
    cameraEnabled: events.some(e => e.type === 'camera-on'), cameraException: events.some(e => e.type === 'camera-exception'), capturing: session.status === 'active',
    note: 'Page visibility and window focus are browser-reported context. They do not reveal other tabs or prove outside assistance, identity, or misconduct. Camera observations are device-reported estimates of visible geometry, not evidence of concentration or misconduct. Processing stays on the device; only event summaries are stored, with no image or video.' }
}
