import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {supportedTransferOriginal,setup} from './helpers.js'
import {createAI} from '../server/ai.js'
import {getConfig} from '../server/config.js'
import {preparedInterview} from '../server/prepared-interviews.js'
import {installDemoAssignments} from '../server/demo-assignments.js'
import {projectSampleText} from '../shared/project-demo.js'
import {conversationLead} from '../shared/conversation.js'
const matlab=readFileSync(new URL('../server/demo-materials/practicing-answers.m',import.meta.url),'utf8')

test('prepared banks match actual work, protect answer guides and reject unrelated uploads',()=>{
 const math=preparedInterview(matlab,{id:'sample-matlab'})
 assert.equal(math.analysis.questions.length,5)
 assert.equal(math.analysis.questions[2].text,'How do you find where a graph crosses the y-axis?')
 assert.equal(math.pairs.length,3)
 assert.ok(math.analysis.concepts.every(c=>matlab.includes(c.evidence)))
 const project=preparedInterview(projectSampleText,{id:'sample-project'})
 assert.equal(project.analysis.questions.length,6)
 assert.equal(preparedInterview('My project is a small calculator.',{id:'sample-project'}),null)
 const thesis='DeepfakeImageDetectionUsing SpatialRichModels. RGB and SRM use EfficientNet. 20,000 final test images. Ensemble soft-voting. Dataset FFHQ.'
 assert.equal(preparedInterview(thesis,{id:'sample-thesis'}).analysis.questions.length,6)
})

test('standard never adapts: answer patterns preserve all five independent MATLAB questions',async t=>{
 const base=createAI(getConfig({DEMO_MODE:'true'}))
 let adapted=0
 const app=await setup(t,{}, {ai:{...base,adaptInterviewQuestion:async()=>{adapted++;throw Error('Standard must not adapt')}}})
 installDemoAssignments(app.db)
 const sets=[]
 for(const transcript of ["I don't know",'The slope is the change in y divided by the change in x.']){
  let session=(await app.submit({assignmentId:'sample-matlab',text:matlab})).data
  const seen=[]
  assert.equal(session.maxQuestions,5)
  while(session.question){
   assert.equal(session.question.expectedAnswer,undefined)
   seen.push(session.question.text)
   const result=await app.answer(session,transcript)
   assert.equal(result.status,200);session=result.data
  }
  assert.equal(session.status,'completed');assert.equal(session.answered,5);sets.push(seen)
 }
 assert.deepEqual(sets[0],sets[1]);assert.equal(adapted,0)
})

test('wrong y-axis answer is saved as zero, correction is spoken and next question stays independent',async t=>{
 const calls=[]
 const evaluator=createAI(getConfig({DEMO_MODE:'false',OPENAI_API_KEY:'fixture'}),async(url,options)=>{
  const body=JSON.parse(options.body),input=JSON.parse(body.input);calls.push(input)
  const result={centralMisconception:true,reaction:'',status:'PARTIAL',accuracy:'incorrect',addressesQuestion:'yes',reasoning:'explained',application:'not_probed',evidenceQuote:input.transcript,
   explanation:'Setting y to zero finds the x-axis crossing.',followUp:'',feedback:"Not quite. For the y-axis, set x to zero and calculate f(0). That's okay; let's move on."}
  return new Response(JSON.stringify({output:[{content:[{type:'output_text',text:JSON.stringify(result)}]}]}))
 })
 const base=createAI(getConfig({DEMO_MODE:'true'}))
 const app=await setup(t,{}, {ai:{...base,evaluate:(...args)=>evaluator.evaluate(...args.slice(0,3),'live',args[4],args[5])}})
 installDemoAssignments(app.db)
 let session=(await app.submit({assignmentId:'sample-matlab',text:matlab})).data
 session=(await app.answer(session,'',{skip:true})).data
 session=(await app.answer(session,'',{skip:true})).data
 const wrong='I set y to zero and solve f(x)=0 to find x.'
 session=(await app.answer(session,wrong)).data
 assert.equal(session.question.text,'What does a zero of a function mean?')
 assert.match(session.conversationLead,/set x to zero/)
 const saved=app.db.prepare('SELECT * FROM answers WHERE session_id=? AND position=3').get(session.id)
 assert.equal(saved.transcript,wrong);assert.equal(saved.status,'UNCLEAR');assert.equal(JSON.parse(saved.rubric).score,0)
 assert.deepEqual(calls[0].conversation,[])
 assert.equal((await app.request('/sessions/'+session.id)).data.lastAnswerFeedback,session.lastAnswerFeedback)
})

test('repeated uncertainty uses different encouragement without marking a correct answer',async t=>{
 const app=await setup(t);installDemoAssignments(app.db)
 let session=(await app.submit({assignmentId:'sample-matlab',text:matlab})).data
 const messages=[]
 for(let i=0;i<3;i++){session=(await app.answer(session,"I don't know")).data;messages.push(session.conversationLead)}
 assert.equal(new Set(messages).size,3)
 assert.ok(app.db.prepare('SELECT status,rubric FROM answers WHERE session_id=?').all(session.id).every(a=>a.status==='UNCLEAR'&&JSON.parse(a.rubric).score===0))
 for(let i=1;i<=3;i++)assert.doesNotMatch(conversationLead({count:i,kind:'none'}),/thanks|good job|understand/i)
})

test('transfer preserves the changed case and delays corrections until both responses are recorded',async t=>{
 const base=createAI(getConfig({DEMO_MODE:'true'}));const transitions=[]
 const app=await setup(t,{demo:false,openaiKey:'fixture'},{ai:{...base,assessTransferOriginal:supportedTransferOriginal,assessSubmission:async()=>null,
  adaptInterviewQuestion:async(...args)=>{transitions.push(args[1].stage);return base.adaptInterviewQuestion(...args)},
  assessTransferPair:async()=>({assessmentState:'complete',explanationScore:2,transferScore:0,consistencyScore:0,originalQuote:'Change in y divided by change in x.',transferQuote:'Wrong application.',explanationRationale:'Correct slope rule.',transferRationale:'Vertical slope is undefined.',status:'WEAK',gapFlag:false,nextStep:'Check slope.',feedback:'With the same x-values, the line is vertical and its slope is undefined. Let us move on.'})}})
 installDemoAssignments(app.db)
 await app.request('/assignments/sample-matlab',{method:'PATCH',body:{challengeMode:'transfer',pairCount:2}})
 let session=(await app.submit({assignmentId:'sample-matlab',text:matlab})).data
 assert.equal(session.maxQuestions,4)
 session=(await app.answer(session,'Change in y divided by change in x.')).data
 assert.equal(session.question.stage,'apply');assert.match(session.question.text,/\(2,4\).*\(2,9\)/)
 assert.equal(session.lastAnswerFeedback,'');assert.doesNotMatch(session.conversationLead,/undefined/)
 session=(await app.answer(session,'Wrong application.')).data
 assert.equal(session.question.stage,'explain');assert.match(session.lastAnswerFeedback,/undefined/)
 assert.deepEqual(transitions,[])
 const first=app.db.prepare('SELECT rubric FROM answers WHERE session_id=? AND position=1').get(session.id)
 assert.equal(JSON.parse(first.rubric).score,2)
})


test('completed session speaks only its saved last feedback and rejects stale answer IDs',async t=>{
 const speeches=[]
 const app=await setup(t,{voiceProvider:'openai',openaiKey:'fixture'},{fetch:async(url,options)=>{speeches.push(JSON.parse(options.body).input);return new Response(Buffer.from('fake-audio'))}})
 let session=(await app.submit()).data,lastId,firstId=session.question.id
 while(session.question){lastId=session.question.id;session=(await app.answer(session,'',{skip:true})).data}
 assert.match(session.lastAnswerFeedback,/last question/)
 const request=questionId=>fetch(app.base+'/api/sessions/'+session.id+'/speech',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({questionId,feedback:true,text:'Injected words must not be spoken'})})
 assert.equal((await request(lastId)).status,200)
 assert.deepEqual(speeches,[session.lastAnswerFeedback])
 assert.equal((await request(firstId)).status,409)
})


test('recreated assignment with the PDF-extracted title retains all agreed independent MATLAB questions',async t=>{
 const base=createAI(getConfig({DEMO_MODE:'true'}))
 const app=await setup(t,{}, {ai:{...base,analyze:async()=>{throw Error('The agreed source must use the prepared interview')}}})
 installDemoAssignments(app.db)
 assert.equal((await app.request('/assignments/sample-matlab',{method:'DELETE'})).status,200)
 const created=await app.request('/assignments',{method:'POST',body:{title:'Computer Aided Mathematics and Visualization Practice',brief:'Solve the uploaded practice tasks.',subject:'Mathematics'}})
 assert.equal(created.status,201);assert.notEqual(created.data.id,'sample-matlab')
 const expected=preparedInterview(matlab,{id:'sample-matlab'}).analysis.questions.map(q=>q.text)
 let session=(await app.submit({assignmentId:created.data.id,text:matlab})).data
 assert.equal(session.maxQuestions,5)
 const seen=[]
 while(session.question){
  seen.push(session.question.text);assert.equal(session.question.expectedAnswer,undefined)
  session=(await app.answer(session,'',{skip:true})).data
 }
 assert.deepEqual(seen,expected);assert.equal(session.status,'completed')
 assert.equal(preparedInterview(matlab.replace(/\n/g,'\r\n'),{id:created.data.id,title:'Matlab'}).pairs.length,3)
 assert.equal(preparedInterview(matlab.replace('q4_delta_y/q4_delta_x','q4_delta_y*q4_delta_x'),{id:created.data.id,title:'Matlab'}),null)
 assert.equal(preparedInterview('I used MATLAB to calculate a slope.',{id:created.data.id,title:'Matlab'}),null)
 assert.equal(preparedInterview(matlab,{id:created.data.id,title:'Renamed MATLAB worksheet'}).analysis.questions.length,5)
})


test('recreated thesis and demo description recognize the submitted document independent of title',async t=>{
 const thesis='Deepfake Image Detection Using Spatial Rich Models. RGB and SRM use EfficientNet. 20,000 final test images. Ensemble soft-voting. Dataset FFHQ.'
 const base=createAI(getConfig({DEMO_MODE:'true'}))
 const app=await setup(t,{demo:false,openaiKey:'fixture'},{ai:{...base,assessSubmission:async()=>null,analyze:async()=>{throw Error('Agreed demo document must use its prepared questions')},generateTransferPairs:async()=>{throw Error('Agreed demo document must reuse prepared pairs')}}})
 for(const [title,text,id] of [['My Thesis',thesis,'sample-thesis'],['Merit Lens demo description',projectSampleText,'sample-project']]){
  const expected=preparedInterview(text,{id})
  assert.equal(expected.analysis.questions.length,6)
  const created=await app.request('/assignments',{method:'POST',body:{title,brief:'Upload your work and explain its main ideas.'}})
  assert.equal(created.status,201)
  const standard=await app.submit({assignmentId:created.data.id,text})
  assert.equal(standard.status,201);assert.equal(standard.data.maxQuestions,6)
  const standardBank=JSON.parse(app.db.prepare('SELECT bank FROM sessions WHERE id=?').get(standard.data.id).bank)
  assert.deepEqual(standardBank.map(q=>q.text),expected.analysis.questions.map(q=>q.text))
  await app.request('/assignments/'+created.data.id,{method:'PATCH',body:{title:'Renamed demo document',challengeMode:'transfer',pairCount:2}})
  const challenge=await app.submit({assignmentId:created.data.id,text})
  assert.equal(challenge.status,201);assert.equal(challenge.data.maxQuestions,4)
  const challengeBank=JSON.parse(app.db.prepare('SELECT bank FROM sessions WHERE id=?').get(challenge.data.id).bank)
  assert.deepEqual(challengeBank.filter(q=>q.stage==='explain').map(q=>q.text),expected.pairs.slice(0,2).map(p=>p.originalQuestion))
  assert.equal(challenge.data.question.pairSpec,undefined)
 }
 assert.equal(preparedInterview('My thesis uses a camera to study birds.',{id:'new-thesis',title:'Thesis'}),null)
 assert.equal(preparedInterview('I made a calculator for a project demo.',{id:'new-project',title:'Demo description'}),null)
})
