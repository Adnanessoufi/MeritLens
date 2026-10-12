import {test} from 'node:test'
import assert from 'node:assert/strict'
import {setup} from './helpers.js'
import {createAI} from '../server/ai.js'
import {getConfig} from '../server/config.js'
import {responseKind,conversationLead} from '../shared/conversation.js'
import {demoQuestion} from '../server/languages.js'
import {meetingQuestionDuration} from '../shared/meeting-timer.js'
import {makeBank} from '../server/flow.js'
import {meetingMessages} from '../shared/meeting-copy.js'

test('Hungarian conversation and practice questions are native text without changing original claims',()=>{
 assert.match(conversationLead({language:'hu'}),/Adnane/)
 assert.equal(responseKind('Nem tudom.'),'unknown')
 assert.equal(responseKind('Köszönöm a figyelmet.'),'none')
 assert.match(demoQuestion({text:'How did you choose this?',concept:'Functions'},'hu'),/Elmagyaráznád/)
 assert.match(meetingMessages('hu')['tab-warning'],/Hét másodperced/)
})
test('Hungarian session selection persists and reminders use the selected language',async t=>{
 const speeches=[]
 const app=await setup(t,{voiceProvider:'openai',openaiKey:'test-only'},{fetch:async(url,options)=>{speeches.push(JSON.parse(options.body).input);return new Response(Buffer.from('audio'))}})
 let session=(await app.submit({language:'hu'})).data
 assert.equal(session.language,'hu')
 assert.match(session.conversationLead,/Szia/)
 const r=await fetch(app.base+'/api/sessions/'+session.id+'/meeting/voice',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'tab-warning'})})
 assert.equal(r.status,200);await r.arrayBuffer()
 assert.match(speeches[0],/Hét másodperced/)
 assert.equal((await app.request('/sessions/'+session.id)).data.language,'hu')
})

test('Hungarian sample questions remain nonempty and explanation/calculation timing follows the task',()=>{
 const sample=demoQuestion({text:'Why did you store your books in a dictionary instead of a list?',concept:'Dictionaries'},'hu')
 assert.match(sample,/Miért/)
 assert.equal(meetingQuestionDuration({text:sample}),20)
 assert.equal(meetingQuestionDuration({text:'Számítsd ki a derivált értékét ebben a pontban.'}),25)
 const quote='ISBN entries are stored as dictionary keys.'
 const bank=makeBank({concepts:[{name:'Lookup',evidence:quote}],questions:[]},[])
 assert.ok(bank[0].text.includes(quote));assert.ok(!bank[0].text.includes('c.evidence'))
})
