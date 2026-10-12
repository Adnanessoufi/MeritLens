import { test,expect } from '@playwright/test'
import { installFakeCamera } from './devices.js'
import { transferWork } from '../../shared/transfer-fixtures.js'
async function prepared(page,{autoVoice=false}={}){
 await installFakeCamera(page)
 await page.route('**/identity/face-api.esm.js',route=>route.fulfill({contentType:'text/javascript',body:`export const tf={setBackend:async()=>true,ready:async()=>{}};export const nets={tinyFaceDetector:{loadFromUri:async()=>{}},faceLandmark68TinyNet:{loadFromUri:async()=>{}},faceRecognitionNet:{loadFromUri:async()=>{}}};export class TinyFaceDetectorOptions{};export function detectSingleFace(){return{withFaceLandmarks(){return{withFaceDescriptor:async()=>({descriptor:[0]})}}}};export function detectAllFaces(){return{withFaceLandmarks(){return{withFaceDescriptors:async()=>[{descriptor:[0]}]}}}};export const euclideanDistance=()=>0;`}))
 await page.addInitScript(()=>{
  window.qaHidden=false;window.qaSpoken=[];window.qaPose={yaw:0,pitch:0};Object.defineProperty(document,'hidden',{configurable:true,get:()=>window.qaHidden})
  window.SpeechSynthesisUtterance=class{constructor(text){this.text=text}}
  Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{speak(u){window.qaSpoken.push(u.text);setTimeout(()=>u.onend?.(),25)},cancel(){}}})
  const Original=window.Worker
  window.Worker=class{constructor(url,...args){if(!String(url).endsWith('/vision/observer-worker.js'))return new Original(url,...args)}postMessage(data){data.frame?.close();setTimeout(()=>this.onmessage?.({data:data.type==='init'?{type:'ready'}:{type:'result',face:true,pose:window.qaPose,hands:data.hands?2:null,timestamp:data.timestamp}}),10)}terminate(){this.onmessage=null}}
  const devices=navigator.mediaDevices,original=devices.getUserMedia.bind(devices)
  Object.defineProperty(devices,'getUserMedia',{configurable:true,value:async constraints=>{if(!constraints.audio)return original(constraints);return new MediaStream()}})
  window.SpeechRecognition=class{
   start(){window.qaRecognizing=true;setTimeout(()=>this.onresult?.({results:[[{transcript:'The ISBN key avoids scanning every book, giving average constant time lookup with a memory trade-off.'}]]}),50)}
   stop(){window.qaRecognizing=false;setTimeout(()=>this.onend?.(),10)}
   abort(){window.qaRecognizing=false}
  }
 })
 const assignment=await(await page.request.post('/api/assignments',{data:{title:'Meeting room QA',subject:'Computer science',brief:transferWork.brief,concepts:transferWork.concepts}})).json()
 const session=await(await page.request.post('/api/submissions',{data:{requestId:crypto.randomUUID(),assignmentId:assignment.id,student:'Alex · fictional meeting QA',text:transferWork.text}})).json()
 await page.goto('/#/session/'+session.id)
 if(!autoVoice){await page.getByText('Microphone unavailable?',{exact:true}).click();await page.getByRole('button',{name:'Use typing for this demo',exact:true}).click()}
 await page.locator('.camera-setup-copy > .button').click()
 await expect(page.getByText('Face visible · head near starting position',{exact:true})).toBeVisible()
 await expect(page.getByRole('button',{name:'Join meeting',exact:true})).toBeEnabled({timeout:35000})
 await page.getByRole('button',{name:'Join meeting',exact:true}).click()
 await expect(page.getByRole('region',{name:'Live interview meeting'})).toBeVisible()
 return session
}
const hide=page=>page.evaluate(()=>{window.qaHidden=true;document.dispatchEvent(new Event('visibilitychange'))})
const show=page=>page.evaluate(()=>{window.qaHidden=false;document.dispatchEvent(new Event('visibilitychange'))})

test('meeting fits a laptop and closes a typed answer at the adaptive question window',async({page})=>{
 await page.setViewportSize({width:1366,height:768})
 const session=await prepared(page)
 await page.getByRole('button',{name:'Type instead',exact:true}).click()
 await page.getByLabel('Your answer',{exact:true}).fill('The dictionary uses an ISBN key, so lookup is average O(1) instead of scanning a list; extra memory is the trade-off.')
 await page.screenshot({path:'.test-artifacts/screenshots/meeting-room-laptop.png',fullPage:false})
 const leave=await page.getByRole('button',{name:'Leave meeting',exact:true}).boundingBox();expect(leave.y+leave.height).toBeLessThanOrEqual(768)
 await expect(page.getByText('Question 2 / 6',{exact:true})).toBeVisible({timeout:35000})
 const current=await(await page.request.get('/api/sessions/'+session.id)).json();expect([12,20,25,30]).toContain(current.duration);expect(current.answered).toBe(1)
})

test('first tab departure is spoken; returning within grace works; second departure stops for teacher review',async({page})=>{
 const session=await prepared(page)
 await page.getByRole('button',{name:'Type instead',exact:true}).click();await page.getByLabel('Your answer',{exact:true}).fill('This draft survives the meeting stop.')
 await hide(page);await expect(page.getByRole('alertdialog')).toContainText('seven seconds')
 await page.waitForTimeout(3600)
 expect((await(await page.request.get('/api/sessions/'+session.id)).json()).status).toBe('active')
 await show(page)
 await expect(page.getByRole('button',{name:'Continue meeting',exact:true})).toBeEnabled()
 await expect.poll(()=>page.evaluate(()=>window.qaSpoken.some(t=>t.includes('Please do not leave the current tab')))).toBe(true)
 await page.getByRole('button',{name:'Continue meeting',exact:true}).click()
 await hide(page)
 await expect(page.getByRole('heading',{name:'Meeting stopped for review.'})).toBeVisible()
 await show(page)
 await page.getByRole('link',{name:'Open teacher review in this demo',exact:true}).click()
 await expect(page.getByText('Current response draft · not assessed',{exact:true})).toBeVisible()
 await expect(page.getByText('This draft survives the meeting stop.',{exact:true})).toBeVisible()
 await page.getByLabel('Review explanation · visible to the student').fill('I checked this demo interruption with the student.')
 await page.getByLabel('I reviewed the circumstances and any identity concern with the student.').check()
 await page.getByRole('button',{name:'Allow meeting to resume',exact:true}).click()
 await expect(page.getByText(/Meeting reopened/)).toBeVisible()
 const data=await(await page.request.get('/api/sessions/'+session.id)).json();expect(data.status).toBe('active');expect(data.meeting.tabCount).toBe(0)
})

test('sustained head turns produce spoken framing reminders and repeat holds without a cheating verdict',async({page})=>{
 await prepared(page)
 await page.evaluate(()=>{window.qaPose={yaw:40,pitch:0}})
 await expect(page.getByRole('alertdialog')).toContainText('starting camera position',{timeout:10000})
 await page.evaluate(()=>{window.qaPose={yaw:0,pitch:0}})
 await expect(page.getByRole('button',{name:'Continue meeting',exact:true})).toBeEnabled()
 await page.getByRole('button',{name:'Continue meeting',exact:true}).click()
 await page.evaluate(()=>{window.qaPose={yaw:40,pitch:0}})
 await expect(page.getByRole('heading',{name:'Meeting stopped for review.'})).toBeVisible({timeout:12000})
 await expect(page.getByText('Your saved answers and current response draft are preserved. This is not an automatic disqualification.',{exact:true})).toBeVisible()
})

test('automatic voice opens the microphone after the question and advances after the timed response',async({page})=>{
 const session=await prepared(page,{autoVoice:true})
 await expect.poll(()=>page.evaluate(()=>window.qaRecognizing)).toBe(true)
 await expect(page.getByText('Your microphone is on. Speak now.',{exact:true})).toBeVisible()
 await expect(page.getByText('Question 2 / 6',{exact:true})).toBeVisible({timeout:35000})
 const data=await(await page.request.get('/api/sessions/'+session.id)).json();expect(data.answered).toBe(1)
})
