import assert from 'node:assert/strict'
import {readFileSync,writeFileSync} from 'node:fs'
import {createAI} from '../server/ai.js'
import {getConfig} from '../server/config.js'
import {projectSampleText} from '../shared/project-demo.js'
import {safeConversationReaction} from '../shared/conversation.js'
const ai=createAI({...getConfig(),demo:false})
// Public fictional project sample only. No uploaded files or real student records.
const analysis=JSON.parse(readFileSync('.test-artifacts/project-description-analysis.json','utf8'))
const source=projectSampleText.split('Camera and tab checks\n')[1].split('\n\n')[0]
analysis.concepts.push({name:'Camera warnings',evidence:source,method:'Advisory review',claim:'Warnings do not prove cheating.'})
const question={id:'fictional-camera-check',concept:'Camera warnings',text:'If the app sees a possible phone, does that prove cheating? Why?'}
const replies={wrong:'Yes. A camera warning proves cheating, so the AI can fail the student automatically. The teacher does not need to review it.',sound:'No. The camera can make a mistake. A warning is only a reason for teacher review; it does not prove cheating. The teacher should check the saved answers and context.'}
const result={}
for(const [label,reply] of Object.entries(replies)){
 const evaluation=await ai.evaluate(analysis,question,reply,'live')
 assert.equal(safeConversationReaction(evaluation.reaction),evaluation.reaction)
 result[label]={reply,evaluation}
}
writeFileSync('.test-artifacts/reactive-interviewer-qa.json',JSON.stringify(result,null,2))
console.log(JSON.stringify({wrong:result.wrong.evaluation,sound:result.sound.evaluation},null,2))
assert.equal(result.wrong.evaluation.status,'UNCLEAR')
assert.equal(result.wrong.evaluation.accuracy,'incorrect')
assert.equal(result.sound.evaluation.status,'DEMONSTRATED')
assert.notEqual(result.wrong.evaluation.followUp,result.sound.evaluation.followUp)
const wrong=result.wrong
const report=await ai.report([{position:1,concept:question.concept,question:question.text,transcript:wrong.reply,status:wrong.evaluation.status,explanation:wrong.evaluation.explanation,evidence_quote:wrong.evaluation.evidenceQuote,rubric:JSON.stringify(wrong.evaluation)}],'live',analysis)
assert.ok(report.reviewAreas.length)
assert.equal(report.conceptEvidence.find(c=>c.concept==='Camera warnings')?.status,'UNCLEAR')
result.report=report
writeFileSync('.test-artifacts/reactive-interviewer-qa.json',JSON.stringify(result,null,2))
console.log(JSON.stringify({wrong:result.wrong.evaluation,sound:result.sound.evaluation,reportReview:report.reviewAreas},null,2))
