import { mkdir, copyFile, readFile, writeFile, readdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
const root='public/vision'
await mkdir(root+'/wasm',{recursive:true})
await copyFile('node_modules/@mediapipe/tasks-vision/vision_bundle.js',root+'/vision_bundle.js')
for(const name of await readdir('node_modules/@mediapipe/tasks-vision/wasm')) if(/\.(wasm|js)$/.test(name)) await copyFile('node_modules/@mediapipe/tasks-vision/wasm/'+name,root+'/wasm/'+name)
const manifest=[]
for(const name of ['face_landmarker','hand_landmarker']){
 const url=`https://storage.googleapis.com/mediapipe-models/${name}/${name}/float16/latest/${name}.task`
 const response=await fetch(url,{signal:AbortSignal.timeout(60000)})
 if(!response.ok)throw Error('Vision model download failed: '+response.status)
 const bytes=Buffer.from(await response.arrayBuffer())
 await writeFile(root+'/'+name+'.task',bytes)
 manifest.push({name,url,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')})
}
const pkg=JSON.parse(await readFile('node_modules/@mediapipe/tasks-vision/package.json','utf8'))
await writeFile(root+'/manifest.json',JSON.stringify({package:pkg.name,version:pkg.version,license:pkg.license,models:manifest},null,2))
console.log('Self-hosted vision runtime and models prepared:',pkg.version)

await import('./prepare-phone-vision.js')
