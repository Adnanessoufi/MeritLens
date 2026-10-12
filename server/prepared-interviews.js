import {readFileSync} from 'node:fs'

// Recognize the agreed demo documents after recreating or renaming their assignments.
// Preserve operators and numbers: a different solution must get its own interview.
const canonicalMatlab = text => text.replace(/\s+/g, ' ').trim()
const agreedMatlab = canonicalMatlab(readFileSync(new URL('./demo-materials/practicing-answers.m', import.meta.url), 'utf8'))

// Agreed rehearsal sets, used only when the actual uploaded source matches.
// Canonical wording transcribed from the user's agreed preparation guide.
const profiles = JSON.parse(readFileSync(new URL('./demo-materials/agreed-interviews.json', import.meta.url), 'utf8'))

const normalize = text => text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
function sourcePassage(text, anchor) {
 const target=normalize(anchor), positions=[], chars=[]
 for(let i=0;i<text.length;i++){const c=text[i].toLowerCase();if(/[\p{L}\p{N}]/u.test(c)){positions.push(i);chars.push(c)}}
 const start=chars.join('').indexOf(target)
 if(start<0)return null
 const from=text.lastIndexOf('\n',positions[start])+1
 const to=text.indexOf('\n',positions[start+target.length-1])
 return text.slice(from,to<0?text.length:to).trim().slice(0,600)
}
export function preparedInterview(text, assignment) {
 const source=normalize(text)
 const matches=id=>id==='sample-matlab'?['q1yintercept','q4slope','q3tangentslope'].every(s=>source.includes(s))
  :id==='sample-thesis'?['deepfakeimagedetection','srm','efficientnet','soft'].every(s=>source.includes(s))
  :['meritlens','awrittenassignment','cameraprocessing','properlogin'].every(s=>source.includes(s))
 const documentMatches=id=>matches(id)&&profiles[id].questions.every(q=>sourcePassage(text,q.anchor))
 const profileId=canonicalMatlab(text)===agreedMatlab?'sample-matlab'
  : ['sample-thesis','sample-project'].find(documentMatches)
    || (Object.hasOwn(profiles,assignment.id)&&matches(assignment.id)?assignment.id:null)
 const profile=profiles[profileId]
 if(!profile)return null
 const concepts=profile.questions.map(q=>({name:q.concept,evidence:sourcePassage(text,q.anchor),method:q.expectedAnswer,claim:q.expectedAnswer}))
 if(concepts.some(c=>!c.evidence))return null
 const analysis={summary:'Interview prepared from the submitted work.',concepts,sections:[],questions:profile.questions.map(({anchor,...q})=>({...q,independent:true,source:'prepared'}))}
 return {analysis,pairs:profile.pairs.map(p=>({...p,fixedQuestionSet:true,sourceQuote:concepts.find(c=>c.name===p.concept).evidence}))}
}
