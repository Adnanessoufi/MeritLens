import {writeFile} from 'node:fs/promises'
import {randomUUID} from 'node:crypto'
import {openDatabase,seed} from '../server/db.js'
import {createApp} from '../server/app.js'
import {createAI} from '../server/ai.js'
import {getConfig} from '../server/config.js'
import {transferWork,transferProfiles} from '../shared/transfer-fixtures.js'
const config={...getConfig(process.env),demo:false},db=openDatabase(':memory:');seed(db)
db.prepare("UPDATE assignments SET challenge_mode='transfer',concept_count=2 WHERE id='sample-python'").run()
const app=createApp(db,config,{ai:createAI(config)}),server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve))
const base='http://127.0.0.1:'+server.address().port+'/api'
async function request(path,body){const r=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});const data=await r.json();if(!r.ok)throw Error(data.error);return data}
try{
 let session=await request('/submissions',{requestId:randomUUID(),assignmentId:'sample-python',student:'Transfer focus rehearsal · fictional',text:transferWork.text,challengeMode:'transfer',pairCount:2})
 const sessionId=session.id,turns=[]
 while(session.status==='active'){
  const q=session.question;if(q.pairSpec||q.expectedTransfer||q.expectedOriginal)throw Error('Private rubric leaked')
  if(q.stage!==(turns.length%2?'apply':'explain'))throw Error('Pair order is wrong')
  const index=transferWork.concepts.indexOf(q.concept),answer=transferProfiles[0].originals[Math.max(0,index)]
  await request('/sessions/'+sessionId+'/present',{questionId:q.id})
  turns.push({stage:q.stage,concept:q.concept,question:q.text})
  // Deliberately repeats a sound original explanation under the changed condition.
  session=await request('/sessions/'+sessionId+'/answers',{questionId:q.id,transcript:answer,method:'text'})
 }
 if(session.status==='reporting')session=await request('/sessions/'+sessionId+'/report',{})
 const report=await request('/reports/'+session.reportId)
 const receipt=await request('/reports/'+session.reportId+'/receipt')
 if(turns.length!==4||report.transferSummary.completedPairs!==2||!receipt.matches)throw Error('Incomplete challenge or changed evidence')
 const result={at:new Date().toISOString(),model:config.model,turns,summary:report.transferSummary,receiptMatches:receipt.matches,privateRubricHidden:true}
 await writeFile('.test-artifacts/transfer-focus-live.json',JSON.stringify(result,null,2))
 console.log(JSON.stringify({turns:turns.length,concepts:report.transferSummary.conceptCount,completedPairs:report.transferSummary.completedPairs,gaps:report.transferSummary.gapCount,pairScores:report.transferSummary.pairs.map(p=>({concept:p.concept,explain:p.explanationScore,apply:p.transferScore,consistency:p.consistencyScore,gap:p.gapFlag})),receiptMatches:receipt.matches,privateRubricHidden:true},null,2))
}finally{await new Promise(resolve=>server.close(resolve));db.close()}
