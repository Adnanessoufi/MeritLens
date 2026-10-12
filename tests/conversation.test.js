import {getSpeechIdentity} from '../server/speech.js'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {meetingQuestionDuration} from '../shared/meeting-timer.js'
import {conversationLead,isUnknownReply,safeConversationReaction} from '../shared/conversation.js'
import {setup} from './helpers.js'

test('answer windows reflect reasoning/calculation and transfer rather than only word count',()=>{
 assert.equal(meetingQuestionDuration({text:'Which tool did you use?'}),12)
 assert.equal(meetingQuestionDuration({text:'Why did you choose a dictionary?'}),20)
 assert.equal(meetingQuestionDuration({text:'Calculate the slope at this point.'}),25)
 assert.equal(meetingQuestionDuration({text:'What would you change?',stage:'apply'}),25)
 assert.equal(meetingQuestionDuration({text:'Fix the bug.',stage:'apply',pairSpec:{changeType:'bug'}}),30)
})
test('conversation welcomes once per first turn and reassures uncertainty without inventing correctness',()=>{
 assert.match(conversationLead({count:0}),/AI interviewer/)
 assert.match(conversationLead({count:1,previous:"I don't know"}),/no worries/i)
 assert.match(conversationLead({count:1,previous:'I used a dictionary.',stage:'apply'}),/change one detail/)
 assert.ok(isUnknownReply("I don't know man"))
 assert.ok(isUnknownReply("I'm not sure."))
 assert.equal(isUnknownReply("I don't know the exact name, but the derivative measures slope."),false)
 assert.doesNotMatch(conversationLead({count:2,previous:'My answer.'}),/correct|right|perfect/i)
})
test('explicit unknown answer moves standard defence on and preserves the actual transcript',async t=>{
 const app=await setup(t)
 let session=(await app.submit()).data
 assert.match(session.conversationLead,/AI interviewer/)
 const original=session.question.concept
 session=(await app.request('/sessions/'+session.id+'/meeting',{method:'POST',body:{autoVoice:false,cameraUnavailable:true,identityStatus:'not-checked'}})).data
 await app.request('/sessions/'+session.id+'/present',{method:'POST',body:{questionId:session.question.id}})
 session=(await app.request('/sessions/'+session.id+'/answers',{method:'POST',body:{questionId:session.question.id,transcript:"I don't know",method:'text'}})).data
 assert.notEqual(session.question.concept,original)
 assert.match(session.conversationLead,/no worries/i)
 assert.ok(session.spokenQuestionText.endsWith(session.question.text))
 assert.equal(app.db.prepare('SELECT transcript FROM answers WHERE session_id=?').get(session.id).transcript,"I don't know")
})

test('meeting speech includes welcome and transition; replay reads only the question and cache separates both',async t=>{
 const speeches=[]
 const app=await setup(t,{voiceProvider:'openai',openaiKey:'test-only'},{fetch:async(url,options)=>{
  assert.ok(url.endsWith('/audio/speech'))
  speeches.push(JSON.parse(options.body).input)
  return new Response(Buffer.from('synthetic-audio-fixture'))
 }})
 let session=(await app.submit()).data
 session=(await app.request('/sessions/'+session.id+'/meeting',{method:'POST',body:{autoVoice:false,cameraUnavailable:true,identityStatus:'not-checked'}})).data
 const speech=async questionOnly=>{
  const r=await fetch(app.base+'/api/sessions/'+session.id+'/speech',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({questionId:session.question.id,questionOnly})})
  assert.equal(r.status,200)
  await r.arrayBuffer()
 }
 await speech(false);await speech(false);await speech(true)
 assert.equal(speeches.length,2)
 assert.match(speeches[0],/AI interviewer/)
 assert.ok(speeches[0].endsWith(session.question.text))
 assert.equal(speeches[1],session.question.text)
})

test('ElevenLabs voice/model choices have distinct cache keys even with an OpenAI voice configured',()=>{
 const base={voiceProvider:'elevenlabs',openaiVoice:'coral',voice:'will',ttsModel:'eleven_v4_turbo'}
 assert.notEqual(getSpeechIdentity(base),getSpeechIdentity({...base,voice:'george'}))
 assert.notEqual(getSpeechIdentity(base),getSpeechIdentity({...base,ttsModel:'eleven_flash_v2_5'}))
})

test('standard feedback survives reload and never replaces silence handling',async t=>{
 const {createAI}=await import('../server/ai.js');const {getConfig}=await import('../server/config.js')
 const base=createAI(getConfig({DEMO_MODE:'true'}));const reaction="You're focusing on speed. Let's look a little closer."
 const app=await setup(t,{}, {ai:{...base,evaluate:async(...args)=>({...await base.evaluate(...args),feedback:reaction})}})
 let session=(await app.submit()).data
 session=(await app.answer(session,'I used a dictionary because finding the key avoids scanning every book.')).data
 assert.ok(session.conversationLead.startsWith(reaction))
 assert.equal((await app.request('/sessions/'+session.id)).data.conversationLead,session.conversationLead)
 session=(await app.answer(session,'[BLANK_AUDIO]')).data
 assert.match(session.conversationLead,/didn't hear/);assert.doesNotMatch(session.conversationLead,/focusing on speed/)
})
test('reaction guard rejects premature praise, hints and questions',()=>{
 for(const text of ['Perfect, that is correct.','Got it, I understand.','You should use a dictionary.','What do you mean?','You gave a clear, confident answer.','Good point about camera warnings.'])assert.equal(safeConversationReaction(text),'')
 assert.equal(safeConversationReaction("You're trusting the camera warning. Let's examine that."),"You're trusting the camera warning. Let's examine that.")
})
