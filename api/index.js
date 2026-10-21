import { createApp } from '../server/app.js'
import { getConfig } from '../server/config.js'
import { openDatabase } from '../server/db.js'
import { installDemoAssignments } from '../server/demo-assignments.js'

let app
export default async function handler(req, res) {
  if (!app) {
    const config = { ...getConfig(), serverless: true, trustProxy: true }
    if (!config.cloudDatabase) return res.status(503).json({ error: 'Connect a Turso database before using the hosted app.' })
    const db = openDatabase(config.database, config.cloudDatabase)
    if (!db.prepare('SELECT COUNT(*) n FROM assignments').get().n) installDemoAssignments(db)
    app = createApp(db, config)
  }
  await app.locals.sweepInterviewLifecycle()
  return app(req, res)
}
