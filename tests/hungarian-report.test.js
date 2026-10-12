import {test} from 'node:test'
import assert from 'node:assert/strict'
import {PDFParse} from 'pdf-parse'
import {createReportLocalizer} from '../server/localization.js'
import {createAI} from '../server/ai.js'
import {getConfig} from '../server/config.js'
import {setup} from './helpers.js'
import {hungarianText} from '../shared/hu-copy.js'
const answer='This is the ORIGINAL student answer.'

test('report translation changes presentation only, caches results and preserves facts, scores and evidence',async()=>{
 let calls=0
 const localize=createReportLocalizer({translateDisplayStrings:async texts=>{calls++;return texts.map(t=>'Magyar: '+t)}})
 const report={id:'fixture',student:'Ali',submittedText:'ORIGINAL SOURCE',summary:'Overall assessment.',answers:[{id:'a1',position:1,question:'Why this approach?',transcript:answer,explanation:'Specific explanation.',concept:'Slope',status:'PARTIAL',evidence_quote:answer,rubric:{score:1,maxScore:2}}],conceptEvidence:[],gradingResult:{score:7,total:20,summary:'Grade explanation.',criteria:[{name:'Question 1',score:7,maxPoints:20,rationale:'Scoring explanation.',evidenceQuote:'ORIGINAL SOURCE'}]},evidenceReceipt:{matches:true,fingerprint:'unchanged'}}
 const before=JSON.stringify(report),hu=await localize(report,'hu')
 assert.match(hu.summary,/Magyar:/);assert.equal(hu.conceptLabels.Slope,'Meredekség');assert.equal(hu.answers[0].transcript,answer);assert.equal(hu.answers[0].evidence_quote,answer);assert.equal(hu.answers[0].rubric.score,1);assert.equal(hu.gradingResult.score,7);assert.equal(hu.gradingResult.criteria[0].name,'1. kérdés');assert.deepEqual(hu.evidenceReceipt,report.evidenceReceipt)
 assert.equal(JSON.stringify(report),before);await localize(report,'hu');assert.equal(calls,1)
 const en=await localize(report,'en');assert.equal(en.summary,report.summary);assert.equal(en.displayLanguage,'en')
 const failing=createReportLocalizer({translateDisplayStrings:async()=>{throw Error('Unavailable')}})
 await assert.rejects(failing(report,'hu'),/Unavailable/)
})

test('Magyar report, PDF and readable record use Hungarian while the original JSON seal remains unchanged',async t=>{
 const base=createAI(getConfig({DEMO_MODE:'true'})),translations=[]
 const ai={...base,translateDisplayStrings:async texts=>{translations.push(texts);return texts.map(text=>'Magyar értékelés: '+text)}}
 const app=await setup(t,{}, {ai})
 let session=(await app.submit()).data
 session=(await app.answer(session,answer)).data
 session=(await app.request('/sessions/'+session.id+'/skip-defence',{method:'POST',body:{}})).data
 const stored=app.db.prepare('SELECT * FROM reports WHERE id=?').get(session.reportId)
 const receiptBefore=(await app.request('/reports/'+session.reportId+'/receipt')).data
 const translated=await app.request('/reports/'+session.reportId+'?language=hu')
 assert.equal(translated.status,200);assert.equal(translated.data.displayLanguage,'hu');assert.equal(translated.data.answers[0].transcript,answer)
 const pdf=await fetch(app.base+'/api/reports/'+session.reportId+'/download?language=hu');assert.equal(pdf.status,200)
 const parser=new PDFParse({data:new Uint8Array(await pdf.arrayBuffer())});let text;try{text=(await parser.getText()).text}finally{await parser.destroy()}
 assert.match(text,/Értékelési jelentés/);assert.match(text,/Beszélgetés|Kérdések|kérdések/);assert.match(text,/Magyar értékelés/);assert.match(text,/ORIGINAL student answer/);assert.doesNotMatch(text,/Assignment grade|Question results|Assessment report/)
 const txt=await(await fetch(app.base+'/api/reports/'+session.reportId+'/receipt?format=text&language=hu')).text()
 assert.match(txt,/MENTETT BESZÉLGETÉS/);assert.match(txt,/Válasz: This is the ORIGINAL student answer/)
 const receiptAfter=(await app.request('/reports/'+session.reportId+'/receipt')).data
 assert.equal(receiptAfter.matches,true);assert.equal(receiptAfter.fingerprint,receiptBefore.fingerprint);assert.deepEqual(app.db.prepare('SELECT * FROM reports WHERE id=?').get(session.reportId),stored)
 assert.equal(translations.length,1)
})

test('live Hungarian assessment requests Hungarian explanations and preserves recorded quotes',async()=>{
 let instructions
 const ai=createAI(getConfig({DEMO_MODE:'false',OPENAI_API_KEY:'fixture'}),async(_url,options)=>{
  const body=JSON.parse(options.body);instructions=body.instructions
  const data={reaction:'',status:'DEMONSTRATED',explanation:'Helyesen állítja nullára az x értékét.',followUp:'',addressesQuestion:'yes',accuracy:'correct',reasoning:'not_required',application:'not_probed',evidenceQuote:'Az x értékét nullára állítom.',feedback:'Így van.',centralMisconception:false}
  return new Response(JSON.stringify({output:[{content:[{type:'output_text',text:JSON.stringify(data)}]}]}))
 })
 const result=await ai.evaluate({concepts:[]},{text:'Hol metszi a görbe az y-tengelyt?',concept:'Y-axis crossing',independent:true,expectedAnswer:'Set x=0.'},'Az x értékét nullára állítom.','live','hu')
 assert.match(instructions,/ALL generated human-readable prose/);assert.doesNotMatch(instructions,/teacher explanation in English/);assert.equal(result.evidenceQuote,'Az x értékét nullára állítom.');assert.equal(result.status,'DEMONSTRATED')
 assert.equal(hungarianText('demonstrated'),'igazolt');assert.equal(hungarianText('Download PDF'),'PDF letöltése')
})
