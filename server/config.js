export function getConfig(env = process.env) {
  const demo = env.DEMO_MODE === 'true' || (env.DEMO_MODE !== 'false' && !env.OPENAI_API_KEY)
  return {
    demo,
    openaiKey: env.OPENAI_API_KEY || '',
    model: env.OPENAI_MODEL || 'gpt-4.1-mini',
    elevenKey: env.ELEVENLABS_API_KEY || '',
    voice: env.ELEVENLABS_VOICE_ID || 'JBFqnCBsd6RMkjVDRZzb',
    ttsModel: env.ELEVENLABS_TTS_MODEL || 'eleven_multilingual_v2',
    sttModel: env.ELEVENLABS_STT_MODEL || 'scribe_v2',
    database: env.DATABASE_PATH || './data/merit-lens.sqlite',
  }
}
