import {test,expect} from '@playwright/test'
import {installFakeCamera} from './devices.js'
import {projectSampleText} from '../../shared/project-demo.js'

test('audio with a still mouth pauses and preserves the same answer; retry then repetition requires teacher review',async({page})=>{
 test.setTimeout(60000)
 await installFakeCamera(page)
 await page.route('**/identity/face-api.esm.js',route=>route.fulfill({contentType:'text/javascript',body:`export const tf={setBackend:async()=>true,ready:async()=>{}};export const nets={tinyFaceDetector:{loadFromUri:async()=>{}},faceLandmark68TinyNet:{loadFromUri:async()=>{}},faceRecognitionNet:{loadFromUri:async()=>{}}};export class TinyFaceDetectorOptions{};export function detectSingleFace(){return{withFaceLandmarks(){return{withFaceDescriptor:async()=>({descriptor:[0]})}}}};export function detectAllFaces(){return{withFaceLandmarks(){return{withFaceDescriptors:async()=>[{descriptor:[0]}]}}}};export const euclideanDistance=()=>0;`}))
 await page.addInitScript(()=>{
  window.qaAudio=false;window.qaMouthMotion=true;window.qaSpoken=[];window.qaAudioGains=[]
  const original=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
  Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:async options=>{
   if(options.video)return original(options)
   const context=new AudioContext(),oscillator=context.createOscillator(),gain=context.createGain(),destination=context.createMediaStreamDestination()
   oscillator.connect(gain);gain.connect(destination);gain.gain.value=window.qaAudio?.15:0;oscillator.start();window.qaAudioGains.push({gain,context});await context.resume();return destination.stream
  }})
  window.qaSetAudio=value=>{window.qaAudio=value;for(const item of window.qaAudioGains)item.gain.gain.setValueAtTime(value?.15:0,item.context.currentTime)}
  window.SpeechSynthesisUtterance=class{constructor(text){this.text=text}}
  Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{speak(u){window.qaSpoken.push(u.text);u.onstart?.();setTimeout(()=>u.onend?.(),25)},cancel(){}}})
  window.SpeechRecognition=class{start(){this.onresult?.({results:[[{transcript:'This is my saved draft.'}]]})}stop(){this.onend?.()}abort(){}}
  const WorkerOriginal=Worker
  window.Worker=class{constructor(url,...args){if(!String(url).endsWith('/vision/observer-worker.js'))return new WorkerOriginal(url,...args)}postMessage(data){data.frame?.close();setTimeout(()=>this.onmessage?.({data:data.type==='init'?{type:'ready'}:{type:'result',face:true,pose:{yaw:0,pitch:0},hands:null,phone:false,phoneReady:true,mouth:{opening:window.qaMouthMotion?.12+.08*Math.sin(data.timestamp/230):.04,stretch:.5},timestamp:data.timestamp}}),10)}terminate(){this.onmessage=null}}
 })
 await page.route('**/api/config',async route=>{const response=await route.fetch();await route.fulfill({json:{...await response.json(),voice:'browser'}})})
 const created=await(await page.request.post('/api/assignments',{data:{title:'Demo speaker check',brief:'Explain the main ideas in your project description.'}})).json()
 const session=await(await page.request.post('/api/submissions',{data:{requestId:crypto.randomUUID(),assignmentId:created.id,student:'Speaker check fixture',text:projectSampleText}})).json()
 await page.goto('/#/session/'+session.id)
 await page.locator('.camera-setup-copy > .button').click()
 await expect(page.getByRole('button',{name:'Join meeting',exact:true})).toBeEnabled({timeout:30000})
 await page.getByRole('button',{name:'Join meeting',exact:true}).click()
 await expect(page.getByText('Your microphone is on. Speak now.',{exact:true})).toBeVisible()
 await page.evaluate(()=>window.qaSetAudio(true))
 await page.waitForTimeout(3300)
 await expect(page.getByRole('alertdialog')).toHaveCount(0)
 await page.evaluate(()=>{window.qaMouthMotion=false})
 await expect(page.getByRole('alertdialog')).toContainText('I can hear audio, but I cannot see your mouth moving.',{timeout:8000})
 let data=await(await page.request.get('/api/sessions/'+session.id)).json()
 expect(data.question.id).toBe(session.question.id);expect(data.meeting.speakerCount).toBe(1);expect(data.answered).toBe(0);expect(data.responseEndedAt).toBe(null);expect(data.meeting.draft.text).toContain('saved draft')
 await page.screenshot({path:'.test-artifacts/screenshots/speaker-mismatch-warning.png'})
 await page.getByRole('button',{name:'Continue meeting',exact:true}).click()
 await expect(page.getByRole('heading',{name:'Meeting stopped for review.',exact:true})).toBeVisible({timeout:10000})
 data=await(await page.request.get('/api/sessions/'+session.id)).json()
 expect(data.meeting.speakerCount).toBe(2);expect(data.status).toBe('held');expect(data.question.id).toBe(session.question.id);expect(data.answered).toBe(0);expect(data.meeting.draft.text).toContain('saved draft')
 expect(await page.evaluate(()=>window.qaSpoken.some(text=>text.includes('cannot see your mouth moving')))).toBe(true)
})
