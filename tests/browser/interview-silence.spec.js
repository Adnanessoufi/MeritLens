import {projectSampleText} from '../../shared/project-demo.js'
import {test,expect} from '@playwright/test'
import {sample} from '../helpers.js'
function wave(){
 const rate=16000,count=rate,bytes=Buffer.alloc(44+count*2)
 bytes.write('RIFF');bytes.writeUInt32LE(bytes.length-8,4);bytes.write('WAVEfmt ',8);bytes.writeUInt32LE(16,16);bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(1,22);bytes.writeUInt32LE(rate,24);bytes.writeUInt32LE(rate*2,28);bytes.writeUInt16LE(2,32);bytes.writeUInt16LE(16,34);bytes.write('data',36);bytes.writeUInt32LE(count*2,40)
 for(let i=0;i<count;i++)bytes.writeInt16LE(Math.round(Math.sin(i*2*Math.PI*220/rate)*5000),44+i*2)
 return bytes
}
for(const fixture of[{name:'silent microphone',gain:0,transcriptions:0},{name:'unintelligible audio',gain:.1,transcriptions:1}])test(fixture.name+' advances honestly without invented answers; spoken question has read fallback',async({page})=>{
 await page.setViewportSize({width:1366,height:768})
 await page.addInitScript(gainAmount=>{
  const original=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
  navigator.mediaDevices.getUserMedia=async constraints=>{
   if(!constraints.audio)return original(constraints)
   const context=new AudioContext(),destination=context.createMediaStreamDestination(),oscillator=context.createOscillator(),gain=context.createGain()
   gain.gain.value=gainAmount;oscillator.connect(gain);gain.connect(destination);oscillator.start();await context.resume()
   return destination.stream
  }
 },fixture.gain)
 await page.route('**/api/config',async route=>{const response=await route.fetch();await route.fulfill({json:{...await response.json(),voice:'openai',avatarConfigured:true}})})
 await page.route('**/api/sessions/*/speech',route=>route.fulfill({contentType:'audio/wav',body:wave()}))
 let transcriptions=0
 await page.route('**/api/sessions/*/transcribe',route=>{transcriptions++;return route.fulfill(fixture.transcriptions?{status:422,json:{error:'No speech was heard. Try recording again or type your answer.'}}:{json:{text:'Thank you for watching.'}})})
 const session=await(await page.request.post('/api/submissions',{data:{requestId:crypto.randomUUID(),assignmentId:'sample-python',student:'Silent audio fixture',text:sample}})).json()
 await page.goto('/#/session/'+session.id)
 await page.getByText('Camera unavailable?',{exact:true}).click()
 await page.getByRole('button',{name:'Continue without camera',exact:true}).click()
 await page.getByRole('button',{name:'Join meeting',exact:true}).click()
 await expect(page.getByText(session.question.text,{exact:true})).toHaveCount(0)
 await expect(page.getByRole('button',{name:'Finish speaking',exact:true})).toBeEnabled({timeout:15000})
 await page.waitForTimeout(1000)
 await page.getByRole('button',{name:'Finish speaking',exact:true}).click()
 await expect.poll(async()=> (await(await page.request.get('/api/sessions/'+session.id)).json()).answered).toBe(1)
 const next=await(await page.request.get('/api/sessions/'+session.id)).json()
 expect(next.conversationLead).toContain("didn't catch an answer")
 expect(next.conversationLead).not.toMatch(/got it|understand|thanks/i)
 expect(transcriptions).toBe(fixture.transcriptions)
 await page.getByRole('button',{name:'Read question',exact:true}).click()
 await expect(page.getByText(next.question.text,{exact:true})).toBeVisible()
 const report=await(await page.request.post('/api/sessions/'+session.id+'/leave',{data:{questionId:next.question.id}})).json()
 const record=await(await page.request.get('/api/reports/'+report.reportId)).json()
 expect(record.answers[0].transcript).toBe('')
 expect(record.answers[0].rubric.responseKind).toBe('none')
})


test('last answer feedback plays before completion and remains visible',async({page})=>{
 await page.route('**/api/config',async route=>{const response=await route.fetch();await route.fulfill({json:{...await response.json(),voice:'openai'}})})
 let finalAudio=0
 await page.route('**/api/sessions/*/speech',route=>{if(route.request().postDataJSON().feedback)finalAudio++;return route.fulfill({contentType:'audio/wav',body:wave()})})
 await page.route('**/api/sessions/*/meeting',async route=>{const body=route.request().postDataJSON();const response=await route.fetch({postData:JSON.stringify({...body,autoVoice:false})});await route.fulfill({response})})
 let session=await(await page.request.post('/api/submissions',{data:{requestId:crypto.randomUUID(),assignmentId:'sample-project',student:'Final feedback fixture',text:projectSampleText}})).json()
 for(let i=0;i<5;i++){
  await page.request.post('/api/sessions/'+session.id+'/present',{data:{questionId:session.question.id}})
  session=await(await page.request.post('/api/sessions/'+session.id+'/answers',{data:{questionId:session.question.id,transcript:'',skip:true}})).json()
 }
 expect(session.questionNumber).toBe(6)
 await page.goto('/#/session/'+session.id)
 await page.getByText('Camera unavailable?',{exact:true}).click()
 await page.getByRole('button',{name:'Continue without camera',exact:true}).click()
 await page.getByText('Microphone unavailable?',{exact:true}).click()
 await page.getByRole('button',{name:'Use typing for this demo',exact:true}).click()
 await page.getByRole('button',{name:'Join meeting',exact:true}).click()
 const skip=page.getByRole('button',{name:'I don’t know',exact:true})
 await expect(skip).toBeEnabled({timeout:15000});await skip.click()
 await expect(page.getByRole('heading',{name:'Interview complete',exact:true})).toBeVisible({timeout:15000})
 expect(finalAudio).toBe(1)
 await expect(page.getByText(/That's the last question. Thanks for taking part./)).toBeVisible()
})
