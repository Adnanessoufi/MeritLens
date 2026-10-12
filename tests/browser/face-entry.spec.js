import {test,expect} from '@playwright/test'
import {installFakeCamera} from './devices.js'
import {transferWork} from '../../shared/transfer-fixtures.js'
async function entry(page){
 await installFakeCamera(page)
 await page.addInitScript(()=>{
  window.qaFaceVisible=false;window.qaReferenceWrong=false
  window.SpeechSynthesisUtterance=class{constructor(text){this.text=text}}
  Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{speak(u){setTimeout(()=>u.onend?.(),25)},cancel(){}}})
  const Original=Worker
  window.Worker=class{constructor(url,...args){if(!String(url).endsWith('/vision/observer-worker.js'))return new Original(url,...args)}postMessage(data){data.frame?.close();setTimeout(()=>this.onmessage?.({data:data.type==='init'?{type:'ready'}:{type:'result',face:window.qaFaceVisible,pose:{yaw:0,pitch:0},phone:false,phoneReady:true,hands:null,timestamp:data.timestamp}}),10)}terminate(){this.onmessage=null}}
 })
 await page.route('**/identity/face-api.esm.js',route=>route.fulfill({contentType:'text/javascript',body:`export const tf={setBackend:async()=>true,ready:async()=>{}};export const nets={tinyFaceDetector:{loadFromUri:async()=>{}},faceLandmark68TinyNet:{loadFromUri:async()=>{}},faceRecognitionNet:{loadFromUri:async()=>{}}};export class TinyFaceDetectorOptions{};export function detectSingleFace(){return{withFaceLandmarks(){return{withFaceDescriptor:async()=>({descriptor:[0]})}}}};export function detectAllFaces(){return{withFaceLandmarks(){return{withFaceDescriptors:async()=>window.qaFaceVisible?[{descriptor:[window.qaReferenceWrong?1:0]}]:[]}}}};export const euclideanDistance=(a,b)=>Math.abs(a[0]-b[0]);`}))
 const assignment=await(await page.request.post('/api/assignments',{data:{title:'Face entry QA',brief:transferWork.brief,subject:'Computer science',concepts:transferWork.concepts}})).json()
 const session=await(await page.request.post('/api/submissions',{data:{requestId:crypto.randomUUID(),assignmentId:assignment.id,student:'Face entry · fictional',text:transferWork.text}})).json()
 await page.goto('/#/session/'+session.id)
 await page.locator('.camera-setup-copy > .button').click()
 return session
}

test('join is blocked without a face; reference match unlocks adaptive meeting with no student room/time controls',async({page})=>{
 await page.setViewportSize({width:1366,height:768})
 const session=await entry(page)
 await expect(page.getByRole('button',{name:'Join meeting',exact:true})).toBeDisabled()
 await expect(page.getByLabel('Meeting room',{exact:true})).toHaveCount(0)
 await expect(page.getByLabel('Answer window',{exact:true})).toHaveCount(0)
 await expect(page.getByLabel('Automatic microphone',{exact:true})).toHaveCount(0)
 await page.evaluate(()=>{window.qaFaceVisible=true})
 await expect(page.getByText('Face matches this photo',{exact:true})).toBeVisible({timeout:20000})
 await expect(page.getByRole('button',{name:'Join meeting',exact:true})).toBeEnabled()
 await expect(page.getByText('Student: Adnane Essoufi',{exact:true})).toBeVisible()
 await expect(page.locator('.reference-check img')).toHaveAttribute('src','/identity/reference-glasses.png')
 await page.getByText('Microphone unavailable?',{exact:true}).click();await page.getByRole('button',{name:'Use typing for this demo',exact:true}).click()
 await page.screenshot({path:'.test-artifacts/screenshots/reference-face-preflight.png',fullPage:false})
 await page.getByRole('button',{name:'Join meeting',exact:true}).click()
 await expect(page.getByRole('region',{name:'Live interview meeting'})).toBeVisible()
 const data=await(await page.request.get('/api/sessions/'+session.id)).json()
 expect(data.meeting.budgetMode).toBe('adaptive');expect([12,15,20,25]).toContain(data.duration)
})

test('a nonmatching reference cannot join automatically and requests human review',async({page})=>{
 await entry(page)
 await page.evaluate(()=>{window.qaFaceVisible=true;window.qaReferenceWrong=true})
 await expect(page.getByText('Reference comparison needs teacher review',{exact:true})).toBeVisible({timeout:20000})
 await expect(page.getByRole('button',{name:'Join meeting',exact:true})).toBeDisabled()
 await page.getByRole('button',{name:'Ask teacher to verify',exact:true}).click()
 await expect(page.getByRole('heading',{name:'Meeting stopped for review.'})).toBeVisible()
})

test('camera-unavailable fallback removes verification prompts and joins in a compact laptop setup',async({page})=>{
 await page.setViewportSize({width:1366,height:768});const session=await entry(page)
 await page.getByText('Camera unavailable?',{exact:true}).click()
 await page.getByRole('button',{name:'Continue without camera',exact:true}).click()
 await expect(page.locator('.reference-check')).toHaveCount(0)
 await expect(page.getByText('Enable camera first',{exact:true})).toHaveCount(0)
 await expect(page.getByRole('button',{name:'Retry camera',exact:true})).toHaveCount(0)
 await expect(page.getByRole('button',{name:'Join meeting',exact:true})).toBeEnabled()
 await expect(page.getByRole('button',{name:'Join meeting',exact:true})).toBeInViewport()
 await page.getByText('Microphone unavailable?',{exact:true}).click();await page.getByRole('button',{name:'Use typing for this demo',exact:true}).click()
 await page.screenshot({path:'.test-artifacts/screenshots/compact-camera-fallback.png'})
 await page.getByRole('button',{name:'Join meeting',exact:true}).click()
 await expect(page.getByRole('region',{name:'Live interview meeting'})).toBeVisible()
 const data=await(await page.request.get('/api/sessions/'+session.id)).json();expect(data.meeting.identityReportedStatus).toBe('not-checked')
})
