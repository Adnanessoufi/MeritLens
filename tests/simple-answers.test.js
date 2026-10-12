import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createAI} from '../server/ai.js'
import {getConfig} from '../server/config.js'

const analysis={concepts:[{name:'Function value',evidence:'f(0) = -3',claim:'The value is minus three.'}],questions:[]}
function aiResult(overrides={}){
 const result={reaction:'',status:'PARTIAL',explanation:'Direct correct value.',followUp:'What is the value at one?',addressesQuestion:'yes',accuracy:'correct',reasoning:'not_required',application:'not_probed',evidenceQuote:'-3',...overrides}
 return createAI(getConfig({OPENAI_API_KEY:'test-only',DEMO_MODE:'false'}),async()=>new Response(JSON.stringify({output:[{content:[{type:'output_text',text:JSON.stringify(result)}]}]})))
}
test('a correct one-value answer can fully satisfy a direct question',async()=>{
 const result=await aiResult().evaluate(analysis,{concept:'Function value',text:'What is f(0)?'},'-3','live')
 assert.equal(result.status,'DEMONSTRATED')
})
test('short factual answers still require correct relevant quoted evidence',async()=>{
 for(const row of [{accuracy:'incorrect',expected:'UNCLEAR'},{addressesQuestion:'no',expected:'UNCLEAR'},{accuracy:'not_established',expected:'UNCLEAR'},{accuracy:'incomplete',expected:'PARTIAL'},{reasoning:'limited',expected:'PARTIAL'},{evidenceQuote:'',expected:'PARTIAL'},{application:'limited',expected:'PARTIAL'}]){
  const {expected,...fields}=row
  const result=await aiResult(fields).evaluate(analysis,{concept:'Function value',text:'What is f(0)?'},'-3','live')
  assert.equal(result.status,expected)
 }
 await assert.rejects(aiResult({evidenceQuote:'The value is four.'}).evaluate(analysis,{concept:'Function value',text:'What is f(0)?'},'-3','live'),/incomplete response|quoted words/)
})
