import express from 'express'
import { resolve } from 'node:path'
import { existsSync } from 'node:fs'
import { getConfig } from './config.js'
import { openDatabase, seed } from './db.js'
import { createApp } from './app.js'

const config = getConfig()
const db = openDatabase(config.database)
seed(db)
const app = createApp(db, config)
const dev = process.argv.includes('--dev')
if (dev) {
  const { createServer } = await import('vite')
  const vite = await createServer({
    server: { middlewareMode: true, watch: { ignored: ['**/data/**', '**/.test-artifacts/**'] } },
    appType: 'spa',
  })
  app.use(vite.middlewares)
} else {
  if (!existsSync(resolve('dist/index.html'))) throw new Error('Run npm run build before npm start.')
  app.use(express.static(resolve('dist')))
  app.get('/{*path}', (req, res) => res.sendFile(resolve('dist/index.html')))
}
const port = Number(process.env.PORT || 5173)
const host = process.env.HOST || '127.0.0.1'
const server = app.listen(port, host, () => {
  console.log(`\n  Merit Lens → http://${host}:${port}\n  ${config.demo ? 'Demo analysis' : 'OpenAI analysis'} · ${config.elevenKey ? 'ElevenLabs voice' : 'Browser voice'} · SQLite\n`)
})
server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? `Port ${port} is in use. Set PORT in .env to another port.` : error.message); process.exit(1) })
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => { db.close(); process.exit(0) }))
