import {installDemoAssignments} from './demo-assignments.js'
import express from 'express'
import { resolve } from 'node:path'
import { existsSync } from 'node:fs'
import { createServer as createHttpServer } from 'node:http'
import { getConfig } from './config.js'
import { openDatabase, seed } from './db.js'
import { createApp } from './app.js'

const config = getConfig()
const db = openDatabase(config.database)
if(config.database===':memory:'){seed(db);installDemoAssignments(db)}
else if(!db.prepare('SELECT COUNT(*) n FROM assignments').get().n)installDemoAssignments(db)
const app = createApp(db, config)
const server = createHttpServer(app)
server.on('close',()=>app.locals.stopInterviewLifecycle?.())
const dev = process.argv.includes('--dev')
let vite
if (dev) {
  const { createServer } = await import('vite')
  vite = await createServer({
    server: { middlewareMode: true, hmr: { server }, watch: { ignored: ['**/data/**', '**/.test-artifacts/**'] } },
    appType: 'spa',
  })
  app.use(vite.middlewares)
} else {
  if (!existsSync(resolve('dist/index.html'))) throw new Error('Run npm run build before npm start.')
  app.use(express.static(resolve('dist')))
  app.get('/{*path}', (req, res) => res.sendFile(resolve('dist/index.html')))
}
const port = Number(process.env.PORT || 5175)
const host = process.env.HOST || '127.0.0.1'
server.listen(port, host, () => {
  console.log(`\n  Merit Lens → http://${host}:${port}\n  ${config.demo ? 'Demo analysis' : 'OpenAI analysis'} · ${config.voiceProvider === 'openai' ? 'OpenAI voice' : config.voiceProvider === 'browser' ? 'Browser voice' : config.elevenKey ? 'ElevenLabs voice' : config.openaiKey ? 'OpenAI voice' : 'Browser voice'} · SQLite\n`)
})
server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? `Port ${port} is in use. Set PORT in .env to another port.` : error.message); process.exit(1) })
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(async () => { await vite?.close(); db.close(); process.exit(0) }))
