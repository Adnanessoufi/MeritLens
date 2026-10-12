import assert from 'node:assert/strict'
import {writeFileSync,readFileSync,existsSync} from 'node:fs'
import {createAI} from '../server/ai.js'
import {getConfig} from '../server/config.js'
import {projectSampleText} from '../shared/project-demo.js'
const ai=createAI({...getConfig(),demo:false})
// Synthetic QA sources and replies only. Never read or transmit uploaded student records.
const sources={
 matlab:'I used MATLAB to plot f(x)=x^2-3 for x from -2 to 2. I used a step of 0.1. At x=0 the value is -3. A smaller step gives more points on the curve. I used element-wise power so each x value is squared.',
 thesis:'I built a system to find edited pictures. An RGB model checks visible image patterns. I also used SRM forensic residual cues to pick up small noise changes left by editing. I joined the two methods because the extra noise check can catch clues the normal image check misses. I compared both methods on the same test pictures.',
 project:projectSampleText
}
const analyses=!process.argv.includes('--fresh')&&existsSync('.test-artifacts/simple-question-analysis.json')?JSON.parse(readFileSync('.test-artifacts/simple-question-analysis.json','utf8')):{}
for(const [name,text] of Object.entries(sources)){
 if(analyses[name]?.concepts?.length)continue
 analyses[name]=await ai.analyze(text,{title:name+' fictional QA',brief:'Discuss your submitted work.',concepts:[]})
 assert.ok(analyses[name].concepts.length,name+' needs grounded concepts')
 writeFileSync('.test-artifacts/simple-question-analysis.json',JSON.stringify(analyses,null,2))
}
writeFileSync('.test-artifacts/simple-question-analysis.json',JSON.stringify(analyses,null,2))
const cases=[
 {id:'numeric',topic:'matlab',q:'What is f(0)?',answer:'-3',expected:'DEMONSTRATED'},
 {id:'short-reason',topic:'matlab',q:'Why did you use a smaller step?',answer:'It gives more points, so the curve looks smoother.',expected:'DEMONSTRATED'},
 {id:'plain-thesis',topic:'thesis',q:'What does your extra image check help you find?',answer:'Tiny noise changes left when someone edits a picture.',expected:'DEMONSTRATED'},
 {id:'vague-thesis',topic:'thesis',q:'What does your extra image check help you find?',answer:'It checks many things that the other one cannot check.',expected:'PARTIAL'},
 {id:'simple-project',topic:'project',q:'Who decides the final grade?',answer:'The teacher.',expected:'DEMONSTRATED'},
 {id:'wrong-project',topic:'project',q:'Does a camera warning prove cheating?',answer:'Yes, it always proves the student cheated.',expected:'UNCLEAR'}
]
const results=await Promise.all(cases.map(async row=>{
 const analysis=analyses[row.topic]
 const concept=analysis.concepts.find(c=>c.evidence.includes(row.topic==='matlab'?'step':row.topic==='thesis'?'noise':'teacher'))||analysis.concepts[0]||{name:row.topic+' QA',evidence:sources[row.topic]}
 const result=await ai.evaluate(analysis,{concept:concept.name,text:row.q},row.answer,'live')
 return {...row,result}
}))
writeFileSync('.test-artifacts/simple-interview-qa.json',JSON.stringify({analyses,results},null,2))
for(const [topic,analysis] of Object.entries(analyses))console.log(topic+': '+analysis.questions.map(q=>q.text).join(' | '))
for(const row of results)console.log(row.id+': '+row.result.status+' — '+row.result.explanation+' Follow-up: '+row.result.followUp)
for(const row of results)assert.equal(row.result.status,row.expected,row.id)
for(const analysis of Object.values(analyses))for(const q of analysis.questions){assert.ok(q.text.split(/\s+/).length<=20,q.text);assert.doesNotMatch(q.text,/justify|elaborate|underlying|forensic residual cues|methodological/i)}
console.log('All six answer checks and three assignment question sets passed.')
