import {readFileSync,writeFileSync} from 'node:fs'
import {parseEnv} from 'node:util'
import {getConfig} from '../server/config.js'
import {synthesizeSpeech} from '../server/speech.js'
const fromFile=parseEnv(readFileSync('.env','utf8'))
console.log(JSON.stringify({elevenlabsFileAndProcessAgree:fromFile.ELEVENLABS_API_KEY===process.env.ELEVENLABS_API_KEY}))
const cfg={...getConfig(),voiceProvider:'openai',openaiVoice:'cedar'}
const text="Hi, I'm Adnane, your AI interviewer. Let's talk about your work. Why did you use a dictionary here?"
const audio=await synthesizeSpeech(cfg,text)
writeFileSync('.test-artifacts/interviewer-cedar-preview.mp3',audio)
console.log(JSON.stringify({provider:'openai',voice:'cedar',bytes:audio.length,preview:'.test-artifacts/interviewer-cedar-preview.mp3'}))
