import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createAI} from '../server/ai.js'
import {getConfig} from '../server/config.js'
import {setup} from './helpers.js'
import {installDemoAssignments} from '../server/demo-assignments.js'
import {offTopicFeedback} from '../shared/off-topic.js'
import {elevenLabsStyledText} from '../server/speech-style.js'
import {synthesizeSpeech} from '../server/speech.js'
const prefix='Your dog sounds great, man.'
const feedback=offTopicFeedback({count:1,aside:prefix})+" Let's try the next question."
const options={delivery:{kind:'off-topic',playfulPrefix:prefix},neutralTail:'How do you check whether a point is on a curve?'}

test('tone changes are in supported ElevenLabs payloads only, with a neutral new question and unchanged normal speech',async()=>{
 const combined=feedback+' '+options.neutralTail,styled=elevenLabsStyledText(combined,'eleven_v4_turbo',options)
 assert.match(styled,/^\[playful\] Your dog sounds great, man\./);assert.match(styled,/\[serious\] But please take this seriously/);assert.match(styled,/\[calm\] How do you check/)
 assert.equal(elevenLabsStyledText(combined,'eleven_multilingual_v2',options),combined)
 assert.equal(elevenLabsStyledText('Normal question.','eleven_v4_turbo',{}),'Normal question.')
 let body
 await synthesizeSpeech({voiceProvider:'elevenlabs',elevenKey:'fixture',voice:'chosen-voice',ttsModel:'eleven_v4_turbo'},combined,async(_url,request)=>{body=JSON.parse(request.body);return new Response(Buffer.from('audio'))},options)
 assert.equal(body.text,styled);assert.equal(body.model_id,'eleven_v4_turbo')
 await synthesizeSpeech({voiceProvider:'openai',openaiKey:'fixture'},combined,async(_url,request)=>{body=JSON.parse(request.body);return new Response(Buffer.from('audio'))},options)
 assert.equal(body.input,combined);assert.match(body.instructions,/switch to a calm, firm, serious tone/);assert.doesNotMatch(body.input,/\[playful\]/)
})

test('the app stores clean feedback, protects the tone boundary and sends it in combined and final feedback audio',async t=>{
 const calls=[],base=createAI(getConfig({DEMO_MODE:'true'})),matlab=readFileSync(new URL('../server/demo-materials/practicing-answers.m',import.meta.url),'utf8')
 const app=await setup(t,{voiceProvider:'elevenlabs',elevenKey:'fixture',voice:'chosen-voice',ttsModel:'eleven_v4_turbo'},{ai:base,fetch:async(_url,request)=>{calls.push(JSON.parse(request.body));return new Response(Buffer.from('audio'))}})
 installDemoAssignments(app.db)
 let session=(await app.submit({assignmentId:'sample-matlab',text:matlab})).data
 session=(await app.request('/sessions/'+session.id+'/meeting',{method:'POST',body:{autoVoice:false,cameraUnavailable:true}})).data
 session=(await app.answer(session,'I like my dog.')).data
 assert.equal(session.lastAnswerDelivery.kind,'off-topic');assert.doesNotMatch(session.lastAnswerFeedback,/\[playful\]|\[serious\]/);assert.match(session.lastAnswerFeedback,/But please/)
 const speech=await fetch(app.base+'/api/sessions/'+session.id+'/speech',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({questionId:session.question.id})});assert.equal(speech.status,200);await speech.arrayBuffer()
 assert.match(calls[0].text,/\[playful\]/);assert.match(calls[0].text,/\[serious\]/);assert.match(calls[0].text,/\[calm\] How do you check/)
 const q=await fetch(app.base+'/api/sessions/'+session.id+'/speech',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({questionId:session.question.id,questionOnly:true})});await q.arrayBuffer();assert.doesNotMatch(calls[1].text,/\[playful\]|\[serious\]/)
 while(session.question)session=(await app.answer(session,'I like my dog.')).data
 const report=(await app.request('/reports/'+session.reportId)).data,last=report.answers.at(-1)
 const final=await fetch(app.base+'/api/sessions/'+session.id+'/speech',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({questionId:last.question_id,feedback:true,delivery:{kind:'off-topic',playfulPrefix:'Injected words'}})});assert.equal(final.status,200);await final.arrayBuffer()
 assert.match(calls.at(-1).text,/^\[playful\]/);assert.match(calls.at(-1).text,/\[serious\] But please stay on topic/);assert.doesNotMatch(calls.at(-1).text,/Injected words/)
 assert.equal(report.evidenceReceipt.matches,true)
})
