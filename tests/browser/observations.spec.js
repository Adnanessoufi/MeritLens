import { test, expect } from '@playwright/test'
import { installFakeCamera, startInterview } from './devices.js'
import { transferWork } from '../../shared/transfer-fixtures.js'
async function setup(page) {
 await page.addInitScript(() => {
  window.SpeechSynthesisUtterance=class {constructor(text){this.text=text}}
  Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{speak(u){setTimeout(()=>u.onend?.(),25)},cancel(){}}})
 })
 const assignment=await(await page.request.post('/api/assignments',{data:{title:'Camera observations QA',subject:'Computer science',brief:transferWork.brief,concepts:transferWork.concepts,timingMode:'adaptive'}})).json()
 const session=await(await page.request.post('/api/submissions',{data:{requestId:crypto.randomUUID(),assignmentId:assignment.id,student:'Alex · fictional camera checks',text:transferWork.text}})).json()
 await page.goto('/#/session/'+session.id)
 await page.getByLabel('Meeting room',{exact:true}).uncheck()
 return session
}

test('actual local vision worker detects a portrait and records sustained missing-face context', async ({page}) => {
 test.setTimeout(90000)
 await page.setViewportSize({width:1366,height:768})
 const errors=[];page.on('pageerror',e=>errors.push(e.message))
 await page.addInitScript(() => {
  window.qaFrameMode='face'
  const original=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
  navigator.mediaDevices.getUserMedia=async constraints=>{
   if(!constraints.video)return original(constraints)
   const image=new Image();image.src='/assets/adnane-interviewer.jpg';await image.decode()
   const canvas=document.createElement('canvas');canvas.width=640;canvas.height=480;const ctx=canvas.getContext('2d')
   const draw=()=>{ctx.fillStyle='#d4dad7';ctx.fillRect(0,0,640,480);if(window.qaFrameMode==='face')ctx.drawImage(image,80,0,480,480)}
   draw();const stream=canvas.captureStream(5);const timer=setInterval(draw,200)
   stream.getVideoTracks()[0].addEventListener('ended',()=>clearInterval(timer));return stream
  }
 })
 const session=await setup(page)
 await page.locator('.camera-setup-copy > .button').click()
 await expect(page.getByText('Face visible · head near starting position',{exact:true})).toBeVisible({timeout:45000})
 await page.screenshot({path:'.test-artifacts/screenshots/camera-observations-preflight.png',fullPage:false})
 await page.getByRole('button',{name:'Start oral defence',exact:true}).click()
 await expect(page.getByRole('button',{name:'Record answer'})).toBeEnabled()
 await page.evaluate(()=>{window.qaFrameMode='missing'})
 await expect(page.locator('.observation-status')).toContainText(/Face not detected · [3-9]s/,{timeout:12000})
 await page.screenshot({path:'.test-artifacts/screenshots/camera-observations-laptop.png',fullPage:false})
 await page.evaluate(()=>{window.qaFrameMode='face'})
 const activity=async()=>await(await page.request.get('/api/sessions/'+session.id+'/activity')).json()
 await expect.poll(async()=>(await activity()).cameraObservations.faceMissingSeconds).toBeGreaterThanOrEqual(3)
 expect(errors).toEqual([])
 // The real hand model also initializes locally; there are no hands in this portrait.
 await page.getByLabel('Check hands in frame',{exact:true}).check()
 await expect(page.getByText('Show both hands for 1 second to confirm framing.',{exact:true})).toBeVisible({timeout:20000})
 await expect(page.locator('.observation-status')).toContainText('Face visible',{timeout:15000})
 expect((await activity()).cameraObservations.handsEnabled).toBe(false)
 await page.getByRole('button',{name:'Skip Defence',exact:true}).click()
 await page.getByRole('button',{name:'Yes, skip defence',exact:true}).click()
 await page.getByRole('link',{name:/Open report in teacher demo/}).click()
 await page.getByRole('button',{name:'Transcript & timing',exact:true}).click()
 await expect(page.locator('.camera-evidence-summary')).toContainText('face not detected')
 await page.getByText('Inspect the event timeline').click()
 await expect(page.locator('.activity-timeline')).toContainText('Question 1')
})

test('head-turn and optional hand reminders are question-linked; typing excludes hand events', async ({page}) => {
 await installFakeCamera(page)
 await page.addInitScript(() => {
  const Original=window.Worker
  window.qaVisionSample={face:true,pose:{yaw:0,pitch:0},hands:2}
  window.Worker=class {
   constructor(url,...args){if(!String(url).endsWith('/vision/observer-worker.js'))return new Original(url,...args)}
   postMessage(data){if(data.type==='init'){setTimeout(()=>this.onmessage?.({data:{type:'ready'}}),10);return}data.frame?.close();setTimeout(()=>this.onmessage?.({data:{type:'result',...window.qaVisionSample,timestamp:data.timestamp,hands:data.hands?window.qaVisionSample.hands:null}}),10)}
   terminate(){this.onmessage=null}
  }
 })
 const session=await setup(page)
 await startInterview(page)
 await expect(page.getByText('Face visible · head near starting position',{exact:true})).toBeVisible()
 await page.evaluate(()=>{window.qaVisionSample.pose.yaw=40})
 await expect(page.locator('.observation-status')).toContainText(/Head turned left · [3-9]s/,{timeout:10000})
 await page.evaluate(()=>{window.qaVisionSample.pose.yaw=0})
 const activity=async()=>await(await page.request.get('/api/sessions/'+session.id+'/activity')).json()
 await expect.poll(async()=>(await activity()).cameraObservations.headTurnedSeconds).toBeGreaterThanOrEqual(3)
 await page.getByLabel('Check hands in frame',{exact:true}).check()
 await expect(page.getByText('2 hands visible',{exact:true})).toBeVisible()
 await page.evaluate(()=>{window.qaVisionSample.hands=0})
 await expect(page.locator('.camera-observations')).toContainText(/Hands not detected · [3-9]s/,{timeout:10000})
 await page.getByRole('button',{name:'Can’t speak? Type your answer'}).click()
 await expect.poll(async()=>(await activity()).cameraObservations.handsNotVisibleSeconds).toBeGreaterThanOrEqual(3)
 const handsBefore=(await activity()).cameraObservations.handsNotVisibleSeconds
 await page.getByLabel('Your answer',{exact:true}).fill('I used the ISBN key for average constant-time lookup. This avoids scanning every book, although collisions and memory use are trade-offs.')
 // Wait by checking genuine continued sampling rather than an arbitrary sleep.
 await page.evaluate(()=>{window.qaVisionSample.pose.pitch=35})
 await expect(page.locator('.observation-status')).toContainText(/Head turned down · [3-9]s/,{timeout:10000})
 expect((await activity()).cameraObservations.handsNotVisibleSeconds).toBe(handsBefore)
 await page.evaluate(()=>{window.qaVisionSample.pose.pitch=0})
 await page.getByRole('button',{name:'Send answer',exact:true}).click()
 const events=(await activity()).events.filter(e=>e.type==='head-turned')
 expect(events.every(e=>e.details.questionId===session.question.id && e.details.questionNumber===1)).toBe(true)
})
