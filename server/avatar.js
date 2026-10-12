import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { HttpError } from './extract.js'

// Only server-selected current questions are accepted. No arbitrary prompt/photo URL.
export function createAvatarService(config, request, audioFor, renderConfig = { fluent: false, pad_audio: 0, stitch: true, driver_expressions: { expressions: [{ start_frame: 0, expression: 'neutral', intensity: 0 }] } }) {
  const jobs = new Map()
  let photo = null
  const configured = () => Boolean(config.didKey)
  const keyFor = session => createHash('sha256').update([session.id, session.current.id, session.language, session.current.text].join('\n')).digest('hex')
  function view(job) {
    return { status: job.status, ...(job.status === 'ready' ? { videoUrl: job.videoUrl } : {}), ...(job.error ? { error: job.error } : {}) }
  }
  async function call(path, options = {}) {
    let response
    try {
      response = await request('https://api.d-id.com' + path, { ...options, headers: {
        Authorization: 'Basic ' + config.didKey.replace(/^Basic\s+/i, '').trim(), ...options.headers,
      }, signal: AbortSignal.timeout(30000) })
    } catch { throw new HttpError(502, 'The talking-avatar service could not be reached. You can continue with voice only.') }
    if (!response.ok) {
      const detail = response.status === 401 ? 'The D-ID API key was rejected.' : response.status === 402 ? 'D-ID credits are exhausted.' : response.status === 451 ? 'D-ID could not accept the photo or audio.' : `D-ID returned ${response.status}.`
      throw new HttpError(502, detail + ' You can continue with voice only.')
    }
    const result = await response.json().catch(() => null)
    if (!result) throw new HttpError(502, 'D-ID returned an invalid response. You can continue with voice only.')
    return result
  }
  function photoUrl() {
    if (!photo || Date.now() - photo.created > 20 * 60 * 60 * 1000) {
      const entry = { created: Date.now() }
      photo = entry
      entry.promise = (async () => {
        const image = await readFile(new URL('../public/assets/adnane-interviewer.jpg', import.meta.url))
        const form = new FormData()
        form.append('image', new Blob([image], { type: 'image/jpeg' }), 'adnane.jpg')
        const uploaded = await call('/images', { method: 'POST', body: form })
        if (!uploaded.url) throw new HttpError(502, 'D-ID did not return an uploaded portrait.')
        return uploaded.url
      })().catch(error => { if (photo === entry) photo = null; throw error })
    }
    return photo.promise
  }
  async function generate(session, job) {
    const sourceUrl = await photoUrl()
    const audio = await audioFor(session)
    const form = new FormData()
    form.append('audio', new Blob([audio], { type: 'audio/mpeg' }), 'question.mp3')
    const uploaded = await call('/audios', { method: 'POST', body: form })
    if (!uploaded.url) throw new HttpError(502, 'D-ID did not return uploaded question audio.')
    const talk = await call('/talks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      source_url: sourceUrl, script: { type: 'audio', audio_url: uploaded.url }, config: renderConfig,
    }) })
    if (!talk.id) throw new HttpError(502, 'D-ID did not return an animation identifier.')
    job.talkId = talk.id
    job.status = 'rendering'
  }
  function fail(job, error) {
    job.status = 'error'
    job.error = error instanceof HttpError ? error.message : 'The talking avatar could not be prepared. You can continue with voice only.'
  }
  return {
    configured,
    start(session, retry = false) {
      if (!configured()) return { status: 'disabled' }
      if (!['openai', 'elevenlabs'].includes(config.voiceProvider || (config.elevenKey ? 'elevenlabs' : config.openaiKey ? 'openai' : 'browser'))) {
        return { status: 'error', error: 'Choose OpenAI or ElevenLabs voice in the teacher connection settings to animate the interviewer.' }
      }
      const key = keyFor(session)
      let job = jobs.get(key)
      if (job && Date.now() - job.created > 20 * 60 * 60 * 1000) { jobs.delete(key); job = null }
      if (job && retry && job.status === 'error' && job.talkId && !job.terminal) {
        job.status = 'rendering'; job.error = null; job.created = Date.now(); job.checked = 0
        return view(job)
      }
      if (job && !(retry && job.status === 'error')) return view(job)
      if (jobs.size >= 64) {
        const finished = [...jobs].find(([, value]) => ['ready', 'error'].includes(value.status))
        if (!finished) throw new HttpError(429, 'The talking-avatar queue is full. Continue with voice only or retry later.')
        jobs.delete(finished[0])
      }
      job = { status: 'preparing', created: Date.now(), checked: 0 }
      jobs.set(key, job)
      job.pending = generate(session, job).catch(error => fail(job, error)).finally(() => { job.pending = null })
      return view(job)
    },
    async status(session) {
      if (!configured()) return { status: 'disabled' }
      const job = jobs.get(keyFor(session))
      if (!job) return { status: 'idle' }
      if (!['preparing', 'rendering'].includes(job.status)) return view(job)
      if (Date.now() - job.created > 180000) {
        // Keep the original talk ID. An explicit retry is required for another paid generation.
        if (!job.pending) fail(job, new HttpError(504, 'The avatar took too long to render. You can continue with voice only.'))
        return view(job)
      }
      if (job.talkId && !job.pending && Date.now() - job.checked >= 1200) {
        job.checked = Date.now()
        job.pending = (async () => {
          const talk = await call('/talks/' + encodeURIComponent(job.talkId))
          if (talk.status === 'done') {
            let url
            try { url = new URL(talk.result_url) } catch { throw new HttpError(502, 'D-ID returned an invalid video address.') }
            if (url.protocol !== 'https:') throw new HttpError(502, 'D-ID returned an unsupported video address.')
            job.videoUrl = url.href
            job.status = 'ready'
          } else if (['error', 'rejected'].includes(talk.status)) { job.terminal = true; throw new HttpError(502, 'D-ID could not animate this question. You can continue with voice only.') }
        })().catch(error => fail(job, error)).finally(() => { job.pending = null })
      }
      if (job.pending && job.talkId) await job.pending
      return view(job)
    },
  }
}
