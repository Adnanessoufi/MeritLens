import {test,expect} from '@playwright/test'
import {readFileSync,writeFileSync} from 'node:fs'
import {installFakeCamera} from './devices.js'
import {transferWork} from '../../shared/transfer-fixtures.js'

test('actual local object model detects a visible phone in a public COCO image',async({page})=>{
 test.setTimeout(60000)
 await page.route('**/qa-phone.jpg',route=>route.fulfill({contentType:'image/jpeg',body:readFileSync('.test-artifacts/vision-fixtures/coco-phone-203879.jpg')}))
 await page.goto('/')
 const result=await page.evaluate(async()=>{
  const worker=new Worker('/vision/observer-worker.js'),image=new Image();image.src='/qa-phone.jpg';await image.decode()
  return await new Promise((resolve,reject)=>{
   const timeout=setTimeout(()=>reject(Error('Object worker timed out')),30000)
   worker.onmessage=async({data})=>{if(data.type==='ready'){const frame=await createImageBitmap(image);worker.postMessage({type:'frame',frame,timestamp:performance.now(),hands:false},[frame])}else if(data.type==='result'){clearTimeout(timeout);worker.terminate();resolve({phone:data.phone,phoneReady:data.phoneReady})}else if(data.type==='error'){clearTimeout(timeout);worker.terminate();reject(Error('Object worker failed'))}}
   worker.postMessage({type:'init'})
  })
 })
 writeFileSync('.test-artifacts/phone-model-validation.json',JSON.stringify({source:'COCO val2014 image 203879',...result},null,2))
 expect(result.phoneReady).toBe(true);expect(result.phone).toBe(true)
})

async function waitingMeeting(page){
 await installFakeCamera(page)
 await page.route('**/identity/face-api.esm.js',route=>route.fulfill({contentType:'text/javascript',body:`export const tf={setBackend:async()=>true,ready:async()=>{}};export const nets={tinyFaceDetector:{loadFromUri:async()=>{}},faceLandmark68TinyNet:{loadFromUri:async()=>{}},faceRecognitionNet:{loadFromUri:async()=>{}}};export class TinyFaceDetectorOptions{};export function detectSingleFace(){return{withFaceLandmarks(){return{withFaceDescriptor:async()=>({descriptor:[0]})}}}};export function detectAllFaces(){return{withFaceLandmarks(){return{withFaceDescriptors:async()=>[{descriptor:[0]}]}}}};export const euclideanDistance=()=>0;`}))
 await page.addInitScript(()=>{
  window.qaPhone=false;window.qaPitch=0;window.qaFace=true;window.qaSpoken=[]
  window.SpeechSynthesisUtterance=class{constructor(text){this.text=text}}
  Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{speak(u){window.qaSpoken.push(u.text);setTimeout(()=>u.onend?.(),25)},cancel(){}}})
  const Original=Worker
  window.Worker=class{constructor(url,...args){if(!String(url).endsWith('/vision/observer-worker.js'))return new Original(url,...args)}postMessage(data){data.frame?.close();setTimeout(()=>this.onmessage?.({data:data.type==='init'?{type:'ready'}:{type:'result',face:window.qaFace,pose:{yaw:0,pitch:window.qaPitch},hands:null,phone:window.qaPhone,phoneReady:true,timestamp:data.timestamp}}),10)}terminate(){this.onmessage=null}}
 })
 await page.route('**/api/config',async route=>{const response=await route.fetch();await route.fulfill({json:{...await response.json(),avatarConfigured:true,voice:'browser'}})})
 await page.route('**/api/sessions/*/avatar*',route=>route.fulfill({json:{status:'rendering'}}))
 const assignment=await(await page.request.post('/api/assignments',{data:{title:'Preparation warning QA',brief:transferWork.brief,subject:'Computer science',concepts:transferWork.concepts}})).json()
 const session=await(await page.request.post('/api/submissions',{data:{requestId:crypto.randomUUID(),assignmentId:assignment.id,student:'Camera gap QA · fictional',text:transferWork.text}})).json()
 await page.goto('/#/session/'+session.id)
 await page.getByText('Microphone unavailable?',{exact:true}).click();await page.getByRole('button',{name:'Use typing for this demo',exact:true}).click()
 await page.locator('.camera-setup-copy > .button').click()
 await expect(page.getByText('Face visible · head near starting position',{exact:true})).toBeVisible()
 await expect(page.getByRole('button',{name:'Join meeting',exact:true})).toBeEnabled({timeout:35000})
 await page.getByRole('button',{name:'Join meeting',exact:true}).click()
 await expect(page.getByRole('region',{name:'Live interview meeting'})).toBeVisible()
 return session
}

test('downward head turn gives a spoken direct-camera reminder during the interview',async({page})=>{
 const session=await waitingMeeting(page)
 await page.evaluate(()=>{window.qaPitch=35})
 await expect(page.getByRole('alertdialog')).toContainText('Please look directly at the camera.',{timeout:10000})
 const data=await(await page.request.get('/api/sessions/'+session.id)).json()
 await expect.poll(()=>page.evaluate(()=>window.qaSpoken.includes('Please look directly at the camera.'))).toBe(true)
 expect(data.meeting.warning).toBe('head-down');expect(data.question.id).toBe(session.question.id);expect(data.meeting.cameraCounts['head-turned']).toBe(1)
})

test('the first possible phone stops the interview before a three-second warning window',async({page})=>{
 await page.setViewportSize({width:1366,height:768})
 const session=await waitingMeeting(page)
 await page.evaluate(()=>{window.qaPhone=true})
 await expect(page.getByRole('heading',{name:'Meeting stopped for review.'})).toBeVisible({timeout:2500})
 await expect(page.getByText('Possible phone detected in camera',{exact:true})).toBeVisible()
 await expect(page.getByRole('button',{name:'Continue meeting',exact:true})).toHaveCount(0)
 await page.screenshot({path:'.test-artifacts/screenshots/phone-warning-laptop.png',fullPage:false})
 const data=await(await page.request.get('/api/sessions/'+session.id)).json()
 expect(data.status).toBe('held');expect(data.meeting.cameraCounts['phone-visible']).toBe(1)
 expect(data.question.id).toBe(session.question.id)
 await page.reload();await expect(page.getByRole('heading',{name:'Meeting stopped for review.'})).toBeVisible()
})

test('a phone still stops the meeting while another camera reminder is open',async({page})=>{
 const session=await waitingMeeting(page)
 await page.evaluate(()=>{window.qaPitch=35})
 await expect(page.getByRole('alertdialog')).toContainText('Please look directly at the camera.',{timeout:10000})
 await page.evaluate(()=>{window.qaPhone=true})
 await expect(page.getByRole('heading',{name:'Meeting stopped for review.'})).toBeVisible({timeout:2500})
 const data=await(await page.request.get('/api/sessions/'+session.id)).json()
 expect(data.status).toBe('held');expect(data.meeting.hold.reason).toBe('Possible phone detected in camera')
})


test('looking up counts once and leaving the frame reaches the shared second warning and stops',async({page})=>{
 const session=await waitingMeeting(page)
 await expect(page.locator('.meeting-warning-counts')).toContainText('Camera warnings 0 / 2')
 await page.evaluate(()=>{window.qaPitch=-35})
 await expect(page.getByRole('alertdialog')).toContainText('Please return to your starting camera position.',{timeout:10000})
 await expect(page.locator('.meeting-warning-counts')).toContainText('Camera warnings 1 / 2')
 await page.evaluate(()=>{window.qaPitch=0})
 await expect(page.getByRole('button',{name:'Continue meeting',exact:true})).toBeEnabled()
 await page.getByRole('button',{name:'Continue meeting',exact:true}).click()
 await expect(page.getByRole('alertdialog')).toHaveCount(0)
 await page.evaluate(()=>{window.qaFace=false})
 await expect(page.getByRole('heading',{name:'Meeting stopped for review.',exact:true})).toBeVisible({timeout:10000})
 await expect(page.getByText('Camera warning limit reached',{exact:true})).toBeVisible()
 const data=await(await page.request.get('/api/sessions/'+session.id)).json()
 expect(data.status).toBe('held');expect(data.meeting.cameraCounts['head-turned']).toBe(1);expect(data.meeting.cameraCounts['face-missing']).toBe(1);expect(data.question.id).toBe(session.question.id)
 await page.screenshot({path:'.test-artifacts/screenshots/two-camera-warnings.png'})
 await page.reload();await expect(page.getByRole('heading',{name:'Meeting stopped for review.',exact:true})).toBeVisible()
})
