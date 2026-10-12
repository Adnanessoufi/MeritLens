import {test} from 'node:test'
import assert from 'node:assert/strict'
import {setup} from './helpers.js'
import {verifyReceiptData} from '../server/evidence.js'
import {renderEvidenceText} from '../server/evidence-text.js'

test('saved record download is readable text, JSON stays verifiable, and changes are reported honestly',async t=>{
 const app=await setup(t)
 let session=(await app.submit()).data
 while(session.status==='active')session=(await app.answer(session)).data
 const url=app.base+'/api/reports/'+session.reportId+'/receipt'
 const jsonResponse=await fetch(url);const jsonText=await jsonResponse.text();const receipt=JSON.parse(jsonText)
 assert.ok(jsonText.split('\n').length>10);assert.equal(verifyReceiptData(receipt).matches,true)
 await app.request('/reports/'+session.reportId+'/review',{method:'PATCH',body:{status:'reviewed',notes:'PRIVATE REVIEW NOTE',feedback:'Teacher comment',release:false}})
 const textResponse=await fetch(url+'?format=text');const text=await textResponse.text()
 assert.match(textResponse.headers.get('content-type'),/text\/plain/)
 assert.match(textResponse.headers.get('content-disposition'),/\.txt/)
 assert.match(text,/MERIT LENS/);assert.match(text,/Student: Test Student/)
 assert.match(text,/Check result: Saved record unchanged/);assert.match(text,/Question 1:/);assert.match(text,/Answer:/)
 assert.match(text,/SUBMITTED WORK/);assert.ok(!text.includes('PRIVATE REVIEW NOTE'))
 assert.equal((await app.request('/reports/'+session.reportId+'/receipt')).data.fingerprint,receipt.fingerprint)
 app.db.prepare("UPDATE answers SET transcript='Changed answer' WHERE session_id=? AND position=1").run(session.id)
 const changed=await(await fetch(url+'?format=text')).text()
 assert.match(changed,/Saved record has changed/)
})

test('readable challenge record includes skipped applications without inventing an application score',()=>{
 const text=renderEvidenceText({reportId:'fixture',matches:true,answerCount:1,evidence:{student:'Test',filename:'Work',sourceText:'Fictional work',answers:[],transferChallenge:{explanation:{earned:0,possible:2},transfer:{earned:0,possible:0},consistency:{earned:0,possible:0},gapCount:0,pairs:[{concept:'Idea',assessmentState:'skipped',explanationScore:0,transferScore:null}]}}})
 assert.match(text,/Transfer challenge/);assert.match(text,/Application: Skipped after the first answer/)
 assert.match(text,/Apply: Not assessed/)
})
