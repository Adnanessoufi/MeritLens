import assert from 'node:assert/strict'
import {writeFileSync} from 'node:fs'
import {createAI} from '../server/ai.js'
import {getConfig} from '../server/config.js'
// Fictional inline task only. Never reads or transmits a user document.
const text=`Practice calculations
1. Differentiate f(x)=x^2. (2p)
2. Find f(0) for f(x)=3x+1. (1p)
3. Calculate the determinant of [[1,2],[3,4]]. (6p)
4. Find the length of vector [3,4]. (1p)
5. Solve x^2-1=0. (2p)
6. Find the gradient of f(x,y)=x^2+y^2. (3p)
7. Integrate f(x)=2x from 0 to 1. (3p)
8. Plot f(x)=sin(x) for 0<=x<=2*pi. (2p)`
const ai=createAI(getConfig())
const result=await ai.prepareAssignment(text,'Mathematics','assignment','hu')
const weights=result.rubric.map(c=>c.maxPoints)
assert.deepEqual(weights,[2,1,6,1,2,3,3,2])
assert.equal(weights.reduce((a,b)=>a+b,0),20)
assert.ok(result.rubric.every(c=>c.name.trim()&&c.description.trim()))
writeFileSync('.test-artifacts/hungarian-points-rehearsal.json',JSON.stringify({fictional:true,result,weights,total:20},null,2))
console.log(JSON.stringify({fictional:true,criteria:weights.length,weights,total:20,title:result.title,firstCriterion:result.rubric[0]},null,2))
