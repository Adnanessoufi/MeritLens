import {test} from 'node:test'
import assert from 'node:assert/strict'
import {setup,sample} from './helpers.js'
import {createGradingAI} from '../server/grading.js'
const rubric=[{name:'Correctness',description:'Uses average complexity and valid handling.',maxPoints:60},{name:'Reasoning',description:'Justifies the design.',maxPoints:40}]
test('teacher file preparation, rubric validation and private reference redaction',async t=>{
 const ai={prepareAssignment:async text=>({title:'Uploaded assignment',brief:text,concepts:['Search'],rubric})}
 const app=await setup(t,{}, {ai});const body=new FormData();body.append('file',new Blob([sample]),'task.txt')
 const draft=await app.request('/assignments/prepare',{method:'POST',body});assert.equal(draft.status,200);assert.equal(draft.data.filename,'task.txt');assert.deepEqual(draft.data.rubric,rubric)
 const created=await app.request('/assignments',{method:'POST',body:{title:'Graded task',brief:sample,rubric,instructionsText:sample,referenceAnswer:'PRIVATE_MODEL_ANSWER'}});assert.equal(created.status,201)
 const publicList=await app.request('/assignments');assert.ok(!JSON.stringify(publicList.data).includes('PRIVATE_MODEL_ANSWER'))
 const publicDetail=await app.request('/assignments/'+created.data.id);assert.ok(!JSON.stringify(publicDetail.data).includes('PRIVATE_MODEL_ANSWER'))
 const teacher=await app.request('/teacher/assignments/'+created.data.id);assert.equal(teacher.data.reference_answer,'PRIVATE_MODEL_ANSWER')
 const count=app.db.prepare('SELECT COUNT(*) n FROM assignments').get().n
 const invalid=await app.request('/assignments',{method:'POST',body:{title:'Invalid',brief:sample,rubric:[{name:'Bad',description:'Bad weight',maxPoints:-1}]}});assert.equal(invalid.status,400);assert.equal(app.db.prepare('SELECT COUNT(*) n FROM assignments').get().n,count)
})
test('grade scores are bounded, uncertain evidence not invented and student work is not answer key',async()=>{
 let inputs
 const ai=createGradingAI(async(name,schema,task,data)=>{inputs={task,data};return{summary:'Incorrect claim needs review',criteria:[{index:0,score:99,rationale:'Incorrect complexity claim.',evidenceQuote:'average constant-time',concern:'Check worst case'},{index:1,score:40,rationale:'Uncertain.',evidenceQuote:'invented quote',concern:''}]}},{openaiKey:'fake',model:'fixture'})
 const grade=await ai.assessSubmission(sample,{brief:'Implement a dictionary',rubric,reference_answer:'Average O(1), worst O(n).'});assert.equal(grade.criteria[0].score,60);assert.equal(grade.criteria[1].score,0);assert.equal(grade.criteria[1].scoreUnestablished,true);assert.equal(grade.score,60);assert.equal(grade.status,'needs-review');assert.match(inputs.task,/NEVER an answer key/);assert.equal(inputs.data.privateReference,'Average O(1), worst O(n).')
})
test('suggested grade requires human approval and explicit release, independent of transfer result',async t=>{
 const ai={assessSubmission:async()=>({status:'suggested',summary:'Task checked',criteria:rubric.map(r=>({...r,score:r.maxPoints/2,rationale:'Partial correctness',evidenceQuote:'',concern:''})),score:50,total:100,assessedAt:new Date().toISOString()})}
 const app=await setup(t);let {data:session}=await app.submit();while(session.status==='active')session=(await app.answer(session)).data
 // Add rubric and install assessment through a separately constructed app with the same DB.
 const {createApp}=await import('../server/app.js');const gradingApp=createApp(app.db,{demo:true,openaiKey:'fake',model:'fixture'}, {ai})
 const server=await new Promise(resolve=>{const server=gradingApp.listen(0,'127.0.0.1',()=>resolve(server))});t.after(()=>new Promise(resolve=>server.close(resolve)))
 const req=async(path,body)=>{const r=await fetch('http://127.0.0.1:'+server.address().port+'/api'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return{status:r.status,data:await r.json()}}
 const analyze=await req('/reports/'+session.reportId+'/grade',{});assert.equal(analyze.status,200)
 let feedback=await app.request('/sessions/'+session.id+'/feedback');assert.equal(feedback.data.available,false)
 const reject=await req('/reports/'+session.reportId+'/grade-review',{approved:false,scores:[30,20],notes:'Reviewed',release:true});assert.equal(reject.status,400)
 const excessive=await req('/reports/'+session.reportId+'/grade-review',{approved:true,scores:[100,20],notes:'Reviewed',release:true});assert.equal(excessive.status,400)
 const approve=await req('/reports/'+session.reportId+'/grade-review',{approved:true,scores:[40,30],notes:'Corrected and reviewed.',release:false});assert.equal(approve.status,200);assert.equal(approve.data.score,70)
 feedback=await app.request('/sessions/'+session.id+'/feedback');assert.equal(feedback.data.available,false)
 const release=await req('/reports/'+session.reportId+'/grade-review',{approved:true,scores:[40,30],notes:'Corrected and reviewed.',release:true});assert.equal(release.status,200)
 feedback=await app.request('/sessions/'+session.id+'/feedback');assert.equal(feedback.data.grade.score,70)
 const receipt=await app.request('/reports/'+session.reportId+'/receipt');assert.equal(receipt.data.matches,true)
})

test('Hungarian grading drafts preserve eight explicit task weights without normalizing to 100',async()=>{
 const weights=[2,1,6,1,2,3,3,2],calls=[]
 const ai=createGradingAI(async(name,schema,task,data)=>{calls.push({name,task,data});return name==='teacher_assignment_draft'?{title:'Gyakorló feladat',brief:'Oldd meg a feladatokat.',concepts:['Deriválás'],rubric:weights.map((maxPoints,i)=>({name:(i+1)+'. feladat',description:'A feladat helyes megoldása.',maxPoints}))}:{summary:'Áttekintés szükséges.',criteria:[]}}, {openaiKey:'fixture'})
 const draft=await ai.prepareAssignment('1 (2p) 2 (1p) 3 (6p) 4 (1p) 5 (2p) 6 (3p) 7 (3p) 8 (2p)','Matematika','assignment','hu')
 assert.equal(calls[0].data.responseLanguage,'Hungarian');assert.match(calls[0].task,/one criterion per task/)
 assert.deepEqual(draft.rubric.map(c=>c.maxPoints),weights);assert.equal(draft.rubric.reduce((n,c)=>n+c.maxPoints,0),20)
 await ai.assessSubmission('A beadott megoldás.',{brief:'Oldd meg a feladatot.',rubric:draft.rubric},'hu')
 assert.equal(calls[1].data.responseLanguage,'Hungarian')
})

test('fractional task points preserve quarter-points and cannot round past a criterion maximum',async()=>{
 const fractional=[{name:'Task 1',description:'Correct result.',maxPoints:.25},{name:'Task 2',description:'Valid method.',maxPoints:.5}]
 const ai=createGradingAI(async()=>({summary:'Task checked.',criteria:[{index:0,score:.25,rationale:'Correct.',evidenceQuote:'The final calculation is correct.',concern:''},{index:1,score:.5,rationale:'Correct.',evidenceQuote:'The method is valid.',concern:''}]}),{openaiKey:'fixture'})
 const grade=await ai.assessSubmission('The final calculation is correct. The method is valid.',{brief:'Calculate the result.',rubric:fractional})
 assert.equal(grade.criteria[0].score,.25);assert.equal(grade.score,.75);assert.equal(grade.total,.75)
})

test('missing and incorrect work earns zero while supported partial credit is preserved',async()=>{
 const ai=createGradingAI(async()=>({summary:'Missing testing evidence.',criteria:[{index:0,score:0,rationale:'Incorrect result.',evidenceQuote:'The result is incorrect.',concern:''},{index:1,score:null,rationale:'No testing evidence.',evidenceQuote:'',concern:'No test results provided.'}]}),{openaiKey:'fixture'})
 const grade=await ai.assessSubmission('The result is incorrect.',{brief:'Explain and test.',rubric})
 assert.equal(grade.score,0);assert.deepEqual(grade.criteria.map(r=>r.score),[0,0]);assert.equal(grade.total,100)
})
