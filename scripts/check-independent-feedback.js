import assert from 'node:assert/strict'
import {writeFileSync,readFileSync} from 'node:fs'
import {PDFParse} from 'pdf-parse'
import {createAI} from '../server/ai.js'
import {getConfig} from '../server/config.js'
import {preparedInterview} from '../server/prepared-interviews.js'
import {projectSampleText} from '../shared/project-demo.js'
const matlab=readFileSync(new URL('../server/demo-materials/practicing-answers.m',import.meta.url),'utf8')
const thesisPath=process.argv[2]
if(!thesisPath)throw new Error('Usage: node --env-file-if-exists=.env scripts/check-independent-feedback.js path/to/thesis.pdf')
const parser=new PDFParse({data:readFileSync(thesisPath)})
const thesisText=(await parser.getText()).text;await parser.destroy()
const math=preparedInterview(matlab,{id:'sample-matlab'}),thesis=preparedInterview(thesisText,{id:'sample-thesis'}),project=preparedInterview(projectSampleText,{id:'sample-project'})
assert.ok(thesis,'The actual uploaded thesis must match its agreed question set')
const ai=createAI({...getConfig(),demo:false})
// Live QA uses only fictional replies. Existing submissions are not regraded.
const cases=[
 {name:'wrong-y-axis',question:'How do you find where a graph crosses the y-axis?',answer:'I set y to zero and solve f(x)=0 to find x.',expected:'UNCLEAR',reference:'A y-axis crossing has x=0. Evaluate the function at zero.'},
 {name:'correct-y-axis',question:'How do you find where a graph crosses the y-axis?',answer:'I set x to zero and calculate y.',expected:'DEMONSTRATED',reference:'A y-axis crossing has x=0. Evaluate the function at zero.'},
 {name:'short-teacher',question:'Who decides the final grade?',answer:'The teacher.',expected:'DEMONSTRATED',reference:'In this fictional classroom, the human teacher decides the final grade.'}
]
// Explicit allowlist: outgoing AI data is constructed only from these fictional cases.
// No extracted PDF text, prepared profiles or source passages are sent for verification.
const results=await Promise.all(cases.map(async c=>{
 const analysis={summary:'Fictional verification exercise.',concepts:[{name:c.name,evidence:c.reference,method:c.reference,claim:c.reference}],questions:[],sections:[]}
 const question={concept:c.name,text:c.question,independent:true,expectedAnswer:c.reference}
 return {name:c.name,expected:c.expected,...await ai.evaluate(analysis,question,c.answer,'live')}
}))
writeFileSync('.test-artifacts/independent-feedback-qa.json',JSON.stringify({sourceCounts:{matlab:math.analysis.questions.length,thesis:thesis.analysis.questions.length,project:project.analysis.questions.length},results},null,2))
for(const result of results){console.log(result.name+': '+result.status+' | '+result.feedback);assert.equal(result.status,result.expected);assert.equal(result.followUp,'')}
assert.match(results[0].feedback,/x.*zero|x.*0/i)
console.log('Actual-source matching and live corrective feedback passed.')
