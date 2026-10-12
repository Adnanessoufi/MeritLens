import {getConfig} from '../server/config.js'
const config=getConfig()
if(!config.elevenKey){console.log(JSON.stringify({configured:false}));process.exit(0)}
try{
 const response=await fetch('https://api.elevenlabs.io/v1/voices',{headers:{'xi-api-key':config.elevenKey},signal:AbortSignal.timeout(12000)})
 const data=await response.json().catch(()=>null)
 console.log(JSON.stringify({configured:true,status:response.status,detail:response.ok?undefined:(typeof data?.detail==='string'?data.detail:data?.detail?.status||data?.detail?.message),voices:response.ok?data.voices?.filter(v=>['premade','default'].includes(v.category)).slice(0,30).map(v=>({id:v.voice_id,name:v.name,category:v.category,labels:v.labels})):undefined},null,2))
}catch{console.log(JSON.stringify({configured:true,error:'Connection could not be reached'}))}
