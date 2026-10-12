import {writeFile,readFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
const url='https://storage.googleapis.com/mediapipe-tasks/object_detector/efficientdet_lite0_uint8.tflite'
const response=await fetch(url,{signal:AbortSignal.timeout(60000)})
if(!response.ok)throw Error('Object model download failed: '+response.status)
const bytes=Buffer.from(await response.arrayBuffer())
await writeFile('public/vision/phone_detector.tflite',bytes)
const manifest=JSON.parse(await readFile('public/vision/manifest.json','utf8'))
manifest.models=manifest.models.filter(m=>m.name!=='phone_detector')
manifest.models.push({name:'phone_detector',url,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')})
await writeFile('public/vision/manifest.json',JSON.stringify(manifest,null,2))
console.log('Local phone detector model prepared:',bytes.length,'bytes')
