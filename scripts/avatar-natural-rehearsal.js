import { writeFile, mkdir } from 'node:fs/promises'
import { getConfig } from '../server/config.js'
import { createAvatarService } from '../server/avatar.js'
import { synthesizeSpeech } from '../server/speech.js'
const config = getConfig()
if (!config.didKey) throw Error('D_ID_API_KEY is not configured.')
config.voiceProvider = 'openai'
const text = "Hello, I'm Adnane, your AI interviewer. Let's explore your thinking. I'll ask you to explain an idea from your work, then apply it to a changed situation."
const session = { id: 'avatar-rehearsal', language: 'en', current: { id: 'avatar-greeting', text } }
const service = createAvatarService(config, fetch, session => synthesizeSpeech(config, session.current.text), { fluent: false, pad_audio: 0, stitch: true, driver_expressions: { expressions: [{ start_frame: 0, expression: 'neutral', intensity: 0 }] } })
const started = Date.now()
service.start(session)
let result
for (let i = 0; i < 100; i++) {
  await new Promise(resolve => setTimeout(resolve, 1500))
  result = await service.status(session)
  if (['ready', 'error'].includes(result.status)) break
}
if (result.status !== 'ready') throw Error(result.error || 'Avatar did not finish rendering.')
const video = await fetch(result.videoUrl, { signal: AbortSignal.timeout(30000) })
if (!video.ok) throw Error('Rendered video could not be retrieved.')
const bytes = Buffer.from(await video.arrayBuffer())
if (bytes.length < 1000) throw Error('Rendered video is empty.')
await mkdir('.test-artifacts', { recursive: true })
await writeFile('.test-artifacts/talking-avatar-natural-test.mp4', bytes)
await writeFile('.test-artifacts/talking-avatar-natural-test.json', JSON.stringify({ status: 'ready', provider: 'D-ID', voice: config.openaiVoice, text, renderMilliseconds: Date.now() - started, bytes: bytes.length, video: 'talking-avatar-natural-test.mp4', note: 'Actual provider video using the user-supplied portrait and synthetic OpenAI voice. This greeting is a verification asset, not a student answer.' }, null, 2))
console.log('Talking-avatar rehearsal passed. Video and safe receipt saved in .test-artifacts.')
