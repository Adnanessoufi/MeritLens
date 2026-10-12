import {test} from 'node:test'
import assert from 'node:assert/strict'
import {synthesizeSpeech} from '../server/speech.js'
const config={voiceProvider:'elevenlabs',elevenKey:'fixture',voice:'selected-voice',ttsModel:'selected-model'}

test('a transient voice conflict retries the same voice and text, then returns playable audio',async()=>{
 const calls=[]
 const audio=await synthesizeSpeech(config,'Hi! Let us begin.',async(url,init)=>{
  calls.push({url,body:JSON.parse(init.body)})
  return calls.length===1?new Response(JSON.stringify({detail:{code:'already_processing'}}),{status:409}):new Response(Buffer.from('audio'))
 })
 assert.equal(audio.toString(),'audio');assert.equal(calls.length,2)
 assert.deepEqual(calls[0],calls[1]);assert.match(calls[0].url,/selected-voice/)
 assert.equal(calls[0].body.model_id,'selected-model')
})
test('persistent conflicts stop after three attempts and display the specific safe error code',async()=>{
 let calls=0
 await assert.rejects(synthesizeSpeech(config,'Hi!',async()=>{calls++;return new Response(JSON.stringify({detail:{status:'already_processing'}}),{status:409})}),/409: already_processing/)
 assert.equal(calls,3)
})
test('authorization and quota failures do not retry; raw provider messages cannot leak keys',async()=>{
 for(const status of [401,402,403]){
  let calls=0
  await assert.rejects(synthesizeSpeech(config,'Hi!',async()=>{calls++;return new Response(JSON.stringify({detail:{code:'bad-code with secret',message:'fixture'}}),{status})}),error=>!error.message.includes('fixture')&&!error.message.includes('bad-code'))
  assert.equal(calls,1)
 }
})
