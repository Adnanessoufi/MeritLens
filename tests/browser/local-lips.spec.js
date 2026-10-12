import { test, expect } from '@playwright/test'
import { installFakeCamera } from './devices.js'
import { transferWork } from '../../shared/transfer-fixtures.js'
function wav() {
 const rate=16000,count=rate*4,buffer=Buffer.alloc(44+count*2)
 buffer.write('RIFF');buffer.writeUInt32LE(buffer.length-8,4);buffer.write('WAVEfmt ',8);buffer.writeUInt32LE(16,16);buffer.writeUInt16LE(1,20);buffer.writeUInt16LE(1,22);buffer.writeUInt32LE(rate,24);buffer.writeUInt32LE(rate*2,28);buffer.writeUInt16LE(2,32);buffer.writeUInt16LE(16,34);buffer.write('data',36);buffer.writeUInt32LE(count*2,40)
 for(let i=0;i<count;i++)buffer.writeInt16LE(Math.round(Math.sin(i*2*Math.PI*220/rate)*9000*(Math.floor(i/(rate*.3))%2===0?1:.05)),44+i*2)
 return buffer
}
test('local mouth follows actual audio; surrounding face is pixel-identical; replay and stop work without D-ID',async({page})=>{
 await page.setViewportSize({width:1366,height:768});await installFakeCamera(page)
 await page.addInitScript(()=>{
  const Original=Worker
  window.Worker=class{constructor(url,...args){if(!String(url).endsWith('/vision/observer-worker.js'))return new Original(url,...args)}postMessage(data){data.frame?.close();setTimeout(()=>this.onmessage?.({data:data.type==='init'?{type:'ready'}:{type:'result',face:true,pose:{yaw:0,pitch:0},phone:false,phoneReady:true,hands:null,timestamp:data.timestamp}}),10)}terminate(){this.onmessage=null}}
 })
 await page.route('**/identity/face-api.esm.js',route=>route.fulfill({contentType:'text/javascript',body:`export const tf={setBackend:async()=>true,ready:async()=>{}};export const nets={tinyFaceDetector:{loadFromUri:async()=>{}},faceLandmark68TinyNet:{loadFromUri:async()=>{}},faceRecognitionNet:{loadFromUri:async()=>{}}};export class TinyFaceDetectorOptions{};export function detectSingleFace(){return{withFaceLandmarks(){return{withFaceDescriptor:async()=>({descriptor:[0]})}}}};export function detectAllFaces(){return{withFaceLandmarks(){return{withFaceDescriptors:async()=>[{descriptor:[0]}]}}}};export const euclideanDistance=()=>0;`}))
 await page.route('**/api/config',async route=>{const response=await route.fetch();await route.fulfill({json:{...await response.json(),voice:'openai',avatarConfigured:true}})})
 await page.route('**/api/sessions/*/speech',route=>route.fulfill({contentType:'audio/wav',body:wav()}))
 let avatarRequests=0;page.on('request',request=>{if(request.url().includes('/avatar'))avatarRequests++})
 const errors=[];page.on('pageerror',e=>errors.push(e.message))
 const assignment=await(await page.request.post('/api/assignments',{data:{title:'Local lips QA',brief:transferWork.brief,subject:'Computer science',concepts:transferWork.concepts}})).json()
 const session=await(await page.request.post('/api/submissions',{data:{requestId:crypto.randomUUID(),assignmentId:assignment.id,student:'Local lips · fictional',text:transferWork.text}})).json()
 await page.goto('/#/session/'+session.id);await page.locator('.camera-setup-copy > .button').click()
 await expect(page.getByRole('button',{name:'Join meeting',exact:true})).toBeEnabled({timeout:20000})
 await page.getByText('Microphone unavailable?',{exact:true}).click();await page.getByRole('button',{name:'Use typing for this demo',exact:true}).click()
 await page.getByRole('button',{name:'Join meeting',exact:true}).click()
 const canvas=page.getByLabel('Adnane photo with local lip animation')
 await expect(canvas).toBeVisible()
 await expect(canvas).toHaveAttribute('data-mouth-texture','photographed')
 await expect.poll(async()=>Number(await canvas.getAttribute('data-mouth-level'))).toBeGreaterThan(.65)
 await expect.poll(async()=>Number(await canvas.getAttribute('data-smile-level'))).toBeGreaterThan(0)
 const original=async()=> (await(await page.request.get('/api/sessions/'+session.id)).json())
 expect((await original()).questionStartedAt).toBeNull()
 const preservation=await canvas.evaluate(async node=>{
  const photo=new Image();photo.src='/assets/adnane-interviewer.jpg';await photo.decode()
  const base=document.createElement('canvas');base.width=node.width;base.height=node.height;base.getContext('2d').drawImage(photo,0,0)
  const a=base.getContext('2d').getImageData(0,0,node.width,node.height).data,b=node.getContext('2d').getImageData(0,0,node.width,node.height).data
  const left=Math.round(node.width*.39),top=Math.round(node.height*.611),width=Math.round(node.width*.23),height=Math.round(node.height*.074)
  let outside=0,inside=0
  for(let y=0;y<node.height;y++)for(let x=0;x<node.width;x++){const i=(y*node.width+x)*4;if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2]){if(x>=left&&x<left+width&&y>=top&&y<top+height)inside++;else outside++}}
  return {outside,inside}
 })
 expect(preservation.outside).toBe(0);expect(preservation.inside).toBeGreaterThan(1000)
 const tileWidths=await page.locator('.meeting-stage > div').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().width))
 expect(Math.abs(tileWidths[0]-tileWidths[1])).toBeLessThan(2)
 await expect(page.getByRole('button',{name:'I don’t know',exact:true})).toBeVisible()
 await expect.poll(async()=>Number(await canvas.getAttribute('data-mouth-level'))).toBeGreaterThan(.65)
 await page.screenshot({path:'.test-artifacts/screenshots/local-lips-meeting.png'})
 await expect.poll(async()=> (await original()).questionStartedAt).not.toBeNull()
 await expect(canvas).toHaveAttribute('data-mouth-level','0')
 const started=(await original()).questionStartedAt
 await page.getByRole('button',{name:'Repeat question',exact:true}).click()
 await expect.poll(()=>canvas.getAttribute('data-mouth-level')).not.toBe('0')
 await page.getByRole('button',{name:'Read question',exact:true}).click()
 await expect(canvas).toHaveAttribute('data-mouth-level','0')
 expect((await original()).questionStartedAt).toBe(started)
 expect(avatarRequests).toBe(0);expect(errors).toEqual([])
})
