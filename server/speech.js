import {elevenLabsStyledText,offTopicSpeechParts} from './speech-style.js'
import { HttpError } from './extract.js'

export const getVoiceProvider = config => config.voiceProvider || (config.elevenKey ? 'elevenlabs' : config.openaiKey ? 'openai' : 'browser')
export function getSpeechIdentity(config){
 const provider=getVoiceProvider(config)
 return provider==='openai'?provider+':'+(config.openaiVoice||'coral')+':'+(config.openaiTtsModel||'gpt-4o-mini-tts'):provider==='elevenlabs'?provider+':'+config.voice+':'+config.ttsModel:'browser'
}
function providerKey(config, provider) {
  const key = provider === 'openai' ? config.openaiKey : provider === 'elevenlabs' ? config.elevenKey : ''
  if (!key) throw new HttpError(503, 'Recorded voice is not configured. Reveal the question and use browser dictation or type your answer.')
  return key
}
function failed(provider, step, status, code = '') {
  const reason = status === 401 ? 'The API key was rejected. Update the server configuration.'
    : status === 409 ? 'The voice is temporarily unavailable. Try again in a moment.'
    : status === 429 ? 'The voice service is busy. Try again shortly.'
    : status === 402 ? 'Check your provider credits.'
    : status === 403 ? 'Check access to the selected voice.' : 'Check provider access and quota, then retry.'
  return new HttpError(502, `${provider === 'openai' ? 'OpenAI' : 'ElevenLabs'} ${step} failed (${status}${code ? ': ' + code : ''}). ${reason} You can still reveal the question or type your answer.`)
}
async function errorCode(response) {
  const body = await response.json().catch(() => null)
  const code = body?.detail?.code || body?.detail?.status || ''
  return /^[a-z0-9_]{1,80}$/i.test(code) ? code : ''
}

export async function synthesizeSpeech(config, question, request = fetch, options={}) {
  const provider = getVoiceProvider(config)
  const key = providerKey(config, provider)
  const openai = provider === 'openai'
  const delivery=offTopicSpeechParts(question,options)
  const deliveryInstructions=delivery?' Begin with a light, playful smile in the opening acknowledgement. At the sentence beginning But, pause briefly and switch to a calm, firm, serious tone for the warning. Do not laugh or sound angry. If a new interview question follows, return to a warm neutral voice. Perform this change in delivery without adding or reading any tone labels.':''
  let response
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      response = await request(openai ? 'https://api.openai.com/v1/audio/speech' : `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(config.voice)}?output_format=mp3_44100_128`, {
      method: 'POST', headers: { ...(openai ? { Authorization: 'Bearer ' + key } : { 'xi-api-key': key }), 'Content-Type': 'application/json' },
      body: JSON.stringify(openai ? { model: config.openaiTtsModel || 'gpt-4o-mini-tts', voice: config.openaiVoice || 'coral', input: question,
        instructions: 'Speak like a friendly, relaxed interviewer chatting one-to-one. Warm, natural, lightly playful in the welcome, reassuring when someone is unsure. Brief pauses between the acknowledgement and question. Avoid a lecturing or robotic cadence. Read exactly the supplied words; do not add hints or evaluate correctness.'+deliveryInstructions }
        : { text: elevenLabsStyledText(question,config.ttsModel,options), model_id: config.ttsModel }), signal: AbortSignal.timeout(30000),
    })
    } catch { throw new HttpError(502, 'Voice playback could not be reached. Try Listen Again or See Question.') }
    if (response.ok) break
    const code = await errorCode(response)
    if (!openai && response.status === 409 && attempt < 2) {
      await new Promise(resolve => setTimeout(resolve, 600 * (attempt + 1)))
      continue
    }
    throw failed(provider, 'speech', response.status, code)
  }
  const audio = Buffer.from(await response.arrayBuffer())
  if (!audio.length) throw new HttpError(502, 'The voice service returned empty audio. Try Listen Again or See Question.')
  return audio
}
export async function transcribeAudio(config, file, language, request = fetch) {
  const provider = getVoiceProvider(config)
  const key = providerKey(config, provider)
  const openai = provider === 'openai'
  const form = new FormData()
  form.append('file', new Blob([file.buffer], { type: file.mimetype }), file.originalname)
  if (openai) {
    form.append('model', config.openaiSttModel || 'whisper-1')
    form.append('language', language)
    form.append('response_format', 'json')
  } else {
    form.append('model_id', config.sttModel)
    form.append('tag_audio_events', 'false')
  }
  let response
  try { response = await request(openai ? 'https://api.openai.com/v1/audio/transcriptions' : 'https://api.elevenlabs.io/v1/speech-to-text', {
    method: 'POST', headers: openai ? { Authorization: 'Bearer ' + key } : { 'xi-api-key': key }, body: form, signal: AbortSignal.timeout(60000),
  }) } catch { throw new HttpError(502, 'Transcription could not be reached. Your recording is kept in this tab; retry or type instead.') }
  if (!response.ok) throw failed(provider, 'transcription', response.status)
  const result = await response.json().catch(() => null)
  if (!result?.text?.trim()) throw new HttpError(422, 'No speech was heard. Try recording again or type your answer.')
  return result.text.trim()
}
