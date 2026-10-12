import {getConfig} from '../server/config.js'
import {synthesizeSpeech,transcribeAudio} from '../server/speech.js'
import {writeFileSync} from 'node:fs'
const cfg={...getConfig(),voiceProvider:'elevenlabs',voice:'bIHbv24MWmeRgasZH58o',ttsModel:'eleven_v4_turbo'}
const text="Hi, I'm Adnane, your AI interviewer. Let's talk about your work. Why did you use a dictionary here?"
const began=Date.now(),audio=await synthesizeSpeech(cfg,text)
writeFileSync('.test-artifacts/interviewer-elevenlabs-will-preview.mp3',audio)
const transcript=await transcribeAudio(cfg,{buffer:audio,mimetype:'audio/mpeg',originalname:'voice-preview.mp3'},'en')
writeFileSync('.test-artifacts/interviewer-elevenlabs-will-preview.json',JSON.stringify({voice:'Will',model:cfg.ttsModel,text,transcript,bytes:audio.length},null,2))
console.log(JSON.stringify({voice:'Will',model:cfg.ttsModel,bytes:audio.length,elapsedSeconds:(Date.now()-began)/1000,transcript},null,2))
