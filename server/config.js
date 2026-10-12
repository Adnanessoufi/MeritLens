export function getConfig(env = process.env) {
  const demo = env.DEMO_MODE === 'true' || (env.DEMO_MODE !== 'false' && !env.OPENAI_API_KEY)
  return {
    demo,
    trustProxy: env.TRUST_PROXY === '1',
    demoAccessPassword: env.DEMO_ACCESS_PASSWORD || '',
    requireDemoAccessPassword: env.REQUIRE_DEMO_ACCESS_PASSWORD === 'true',
    openaiKey: env.OPENAI_API_KEY || '',
    model: env.OPENAI_MODEL || 'gpt-4.1-mini',
    voiceProvider: ['openai', 'elevenlabs', 'browser'].includes(env.VOICE_PROVIDER) ? env.VOICE_PROVIDER : '',
    openaiVoice: env.OPENAI_VOICE || 'coral',
    openaiTtsModel: env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts',
    openaiSttModel: env.OPENAI_STT_MODEL || 'whisper-1',
    elevenKey: env.ELEVENLABS_API_KEY || '',
    elevenVoiceName: env.ELEVENLABS_VOICE_NAME || '',
    voice: env.ELEVENLABS_VOICE_ID || 'JBFqnCBsd6RMkjVDRZzb',
    ttsModel: env.ELEVENLABS_TTS_MODEL || 'eleven_multilingual_v2',
    sttModel: env.ELEVENLABS_STT_MODEL || 'scribe_v2',
    database: env.DATABASE_PATH || './data/merit-lens.sqlite',
  }
}
