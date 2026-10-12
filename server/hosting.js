import { createHash, timingSafeEqual } from 'node:crypto'

const digest = value => createHash('sha256').update(value).digest()

export function configureHosting(app, db, config) {
  if (config.trustProxy) app.set('trust proxy', 1)
  if (config.requireDemoAccessPassword && !config.demoAccessPassword) {
    throw new Error('Set DEMO_ACCESS_PASSWORD before starting the hosted demo.')
  }

  app.get('/healthz', (req, res) => {
    try {
      db.prepare('SELECT 1').get()
      res.set('Cache-Control', 'no-store').json({ status: 'ok' })
    } catch {
      res.status(503).json({ status: 'unavailable' })
    }
  })

  if (!config.demoAccessPassword) return
  const expected = digest('demo:' + config.demoAccessPassword)
  app.use((req, res, next) => {
    const authorization = req.get('authorization') || ''
    const credential = authorization.startsWith('Basic ')
      ? Buffer.from(authorization.slice(6), 'base64').toString('utf8')
      : ''
    if (timingSafeEqual(expected, digest(credential))) return next()
    res.set('Cache-Control', 'no-store')
    res.set('WWW-Authenticate', 'Basic realm="Merit Lens demo", charset="UTF-8"')
    res.status(401).json({ error: 'Use the shared demo login to open Merit Lens.' })
  })
}
