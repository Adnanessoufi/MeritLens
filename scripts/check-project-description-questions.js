import {createAI} from '../server/ai.js'
import {getConfig} from '../server/config.js'
import {projectSampleText} from '../shared/project-demo.js'
import {writeFileSync} from 'node:fs'
const ai=createAI({...getConfig(),demo:false})
// Public fictional example only, no uploaded student work or MATLAB reference file.
const analysis=await ai.analyze(projectSampleText,{title:'Project demo defence',brief:'Explain your demo project, your choices and limits.',concepts:[],rubric:[],reference_answer:''},'en')
if(!analysis.concepts.length||!analysis.questions.length)throw Error('No grounded questions prepared')
if(analysis.questions.some(q=>/ISBN|reading-list/i.test(q.text)))throw Error('An unrelated legacy question appeared')
writeFileSync('.test-artifacts/project-description-analysis.json',JSON.stringify(analysis,null,2))
console.log(JSON.stringify({concepts:analysis.concepts.map(c=>c.name),questions:analysis.questions.map(q=>q.text)},null,2))
