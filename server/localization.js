import {createHash} from 'node:crypto'
import {hungarianText} from '../shared/hu-copy.js'
// Presentation translations never alter persisted assessments or evidence receipts.
export function createReportLocalizer(ai){
 const cache=new Map()
 return async function localizeReport(original,language='en'){
  if(language!=='hu')return {...original,displayLanguage:'en'}
  const report=structuredClone(original),fields=[]
  const add=(obj,key)=>{if(typeof obj?.[key]==='string'&&obj[key].trim())fields.push({obj,key,text:obj[key]})}
  add(report,'summary');add(report,'feedback');for(const key of ['strengths','reviewAreas'])report[key]?.forEach((_,i)=>add(report[key],i))
  report.conceptLabels=Object.create(null)
  const concept=name=>{if(name&&!Object.hasOwn(report.conceptLabels,name)){report.conceptLabels[name]=name;add(report.conceptLabels,name)}}
  for(const answer of report.answers||[]){add(answer,'question');add(answer,'explanation');concept(answer.concept)}
  for(const row of report.conceptEvidence||[]){add(row,'reasoning');add(row,'nextStep');concept(row.concept)}
  for(const grade of [report.gradingResult,report.gradeReview]){
   add(grade,'summary');add(grade,'notes');for(const row of grade?.criteria||[]){for(const key of ['name','description','rationale','concern'])add(row,key)}
  }
  if(report.transferSummary){
   add(report.transferSummary,'summary');add(report.transferSummary,'limitation')
   for(const pair of report.transferSummary.pairs||[]){
    concept(pair.concept);for(const key of ['originalQuestion','transferQuestion','changedScenario','explanationRationale','transferRationale','consistencyRationale','nextStep'])add(pair,key)
   }
  }
  const unique=[...new Set(fields.map(f=>f.text))],translated=new Map(),unknown=[]
  for(const text of unique){const fixed=hungarianText(text);if(fixed!==text)translated.set(text,fixed);else unknown.push(text)}
  if(unknown.length){
   const key=createHash('sha256').update(JSON.stringify(unknown)).digest('hex')
   if(!cache.has(key)){
    if(cache.size>=50)cache.delete(cache.keys().next().value)
    const pending=ai.translateDisplayStrings(unknown,'hu').catch(error=>{cache.delete(key);throw error})
    cache.set(key,pending)
   }
   const values=await cache.get(key)
   unknown.forEach((text,i)=>translated.set(text,values[i]))
  }
  for(const field of fields)field.obj[field.key]=translated.get(field.text)||field.text
  return {...report,displayLanguage:'hu'}
 }
}
