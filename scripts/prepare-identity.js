import {mkdir,copyFile,readdir,readFile,writeFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
await mkdir('public/identity/models',{recursive:true})
await copyFile('node_modules/@vladmandic/face-api/LICENSE','public/identity/LICENSE')
await copyFile('node_modules/@vladmandic/face-api/dist/face-api.esm.js','public/identity/face-api.esm.js')
const allowed=['tiny_face_detector','face_landmark_68_tiny','face_recognition']
const manifest=[]
for(const file of await readdir('node_modules/@vladmandic/face-api/model')) if(allowed.some(prefix=>file.startsWith(prefix))){
 await copyFile('node_modules/@vladmandic/face-api/model/'+file,'public/identity/models/'+file)
 const bytes=await readFile('public/identity/models/'+file);manifest.push({file,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')})
}
await copyFile('public/assets/adnane-interviewer.jpg','public/identity/reference.jpg')
await copyFile('public/assets/adnane-interviewer.png','public/identity/reference-glasses.png')
const pkg=JSON.parse(await readFile('node_modules/@vladmandic/face-api/package.json','utf8'))
await writeFile('public/identity/manifest.json',JSON.stringify({package:pkg.name,version:pkg.version,license:pkg.license,scope:'One-to-one comparison with Adnane supplied demo portraits; no age, gender or emotion models.',models:manifest},null,2))
console.log('Local reference-face assets prepared:',pkg.version)
