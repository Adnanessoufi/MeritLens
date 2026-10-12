import {test} from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {extractText,MAX_DOCUMENT_TEXT} from '../server/extract.js'
import {setup} from './helpers.js'

test('uploaded documents preserve text beyond 60k while pasted input keeps its advertised limit',async t=>{
 const text='Long research thesis section with results and methods. '.repeat(1600)
 assert.ok(text.length>60000&&text.length<MAX_DOCUMENT_TEXT)
 const extracted=await extractText({originalname:'long-thesis.txt',buffer:Buffer.from(text)})
 assert.equal(extracted.text,text.trim())
 await assert.rejects(extractText(undefined,text),/60,000/)
 await assert.rejects(extractText({originalname:'too-long.txt',buffer:Buffer.from('a'.repeat(MAX_DOCUMENT_TEXT+1))}),/200,000/)
 const app=await setup(t,{}, {ai:{translateQuestions:async questions=>questions,analyze:async submitted=>{assert.equal(submitted,text.trim());return{summary:'Recorded long document.',concepts:[{name:'Methods',evidence:'Long research thesis section',method:'Methods',claim:'Methods'}],sections:[],questions:[{concept:'Methods',text:'What method did you use?'}]}}}})
 const body=new FormData();body.append('requestId',randomUUID());body.append('student','Large document fixture');body.append('assignmentId','sample-python');body.append('file',new Blob([text]),'long-thesis.txt')
 const response=await app.request('/submissions',{method:'POST',body})
 assert.equal(response.status,201)
 assert.equal(app.db.prepare('SELECT text FROM submissions WHERE id=(SELECT submission_id FROM sessions WHERE id=?)').get(response.data.id).text,text.trim())
 const config=(await app.request('/config')).data;assert.equal(config.maxTextCharacters,60000);assert.equal(config.maxDocumentCharacters,200000)
})
