import {writeFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
import {createAI} from '../server/ai.js'
import {getConfig} from '../server/config.js'

// All content in this rehearsal is fictional and defined here. No user document is read.
const source="books[isbn] = {title: title, status: 'available'}"
const concept={name:'Dictionary keys',evidence:source,method:'Dictionary lookup',claim:'One catalog entry per edition'}
const analysis={summary:'Fictional library catalog exercise.',concepts:[concept],sections:[],questions:[],assignmentSnapshot:{title:'Fictional QA exercise',brief:'Explain a dictionary-key design and apply it to separate physical copies.',reference_answer:''}}
const spec={concept:concept.name,sourceQuote:source,originalQuestion:'Why did you use ISBN as the dictionary key in this catalog?',changedScenario:'The library now lends two physical copies of the same edition. They share an ISBN; one copy is checked out while the other is available.',transferQuestion:'How would you represent and update the two statuses without overwriting either?',changeType:'constraint',invariant:'One key selects one value, so independent copy statuses need independent representation.',expectedOriginal:'Explain the edition key and average lookup benefit in the initial one-entry-per-edition catalog.',expectedTransfer:'Preserve the catalog entry, distinguish the physical copies and update a selected copy without overwriting the other.',acceptableAlternatives:['Nested copy records under each ISBN','Separate copy-ID map linked to ISBN']}
const replies=[
 {kind:'sound',text:'ISBN identifies an edition, and I only store one catalog entry per edition. A dictionary gives me average constant-time lookup rather than scanning a list.'},
 {kind:'mistaken',text:'ISBN identifies every physical book, so two copies can never overwrite one another.'}
]
const ai=createAI({...getConfig(process.env),demo:false},async(url,options)=>{const response=await fetch(url,options);if(JSON.parse(options.body).text.format.name==='answer_grounded_next_question'){const result=await response.clone().json();console.log('SYNTHETIC_ADAPTATION',JSON.stringify(result.output?.flatMap(i=>i.content||[]).filter(i=>i.type==='output_text').map(i=>i.text)))}return response})
const results=[]
for(const reply of replies){
 const q={id:'explain',concept:concept.name,text:spec.originalQuestion}
 const evaluation=await ai.evaluate(analysis,q,reply.text,'live')
 const next={id:'apply',concept:concept.name,stage:'apply',source:'transfer-apply',pairSpec:spec,text:spec.changedScenario+'\n\n'+spec.transferQuestion}
 const adapted=await ai.adaptInterviewQuestion(analysis,next,q,reply.text,[])
 assert.equal(adapted.pairSpec.changedScenario,spec.changedScenario)
 assert.equal(adapted.pairSpec.expectedTransfer,spec.expectedTransfer)
 assert.ok(adapted.text.includes(adapted.adaptation.answerQuote))
 results.push({kind:reply.kind,response:reply.text,status:evaluation.status,standardFollowUp:evaluation.followUp,transferQuestion:adapted.pairSpec.transferQuestion,adaptation:adapted.adaptation})
 console.log(JSON.stringify(results.at(-1)))
}
assert.notEqual(results[0].standardFollowUp,results[1].standardFollowUp)
assert.notEqual(results[0].transferQuestion,results[1].transferQuestion)
await writeFile('.test-artifacts/adaptive-live-rehearsal.json',JSON.stringify({fixture:'Entirely fictional inline exercise',results},null,2))
console.log('PASS: real-provider standard follow-ups and transfer questions differ for the two responses; scenario/rubric preserved.')
