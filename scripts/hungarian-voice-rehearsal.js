import assert from 'node:assert/strict'
import {writeFileSync} from 'node:fs'
import {getConfig} from '../server/config.js'
import {synthesizeSpeech,transcribeAudio} from '../server/speech.js'
// Fictional generated speech only: no student work, user recording, image or private file.
const text='Szia, Adnane vagyok, az AI kérdeződ. Beszélgessünk a munkádról. Miért szótárban tároltad a könyveket lista helyett?'
const config=getConfig(),audio=await synthesizeSpeech(config,text)
assert.ok(audio.length>1000)
const transcript=await transcribeAudio(config,{buffer:audio,mimetype:'audio/mpeg',originalname:'hungarian-qa.mp3'},'hu')
assert.match(transcript,/szótár|könyv|lista/i)
writeFileSync('.test-artifacts/hungarian-voice-qa.mp3',audio)
writeFileSync('.test-artifacts/hungarian-voice-qa.json',JSON.stringify({fictional:true,text,transcript,bytes:audio.length},null,2))
console.log(JSON.stringify({fictional:true,bytes:audio.length,transcript},null,2))
