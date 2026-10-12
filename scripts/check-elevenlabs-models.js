import {getConfig} from '../server/config.js'
const cfg=getConfig()
const r=await fetch('https://api.elevenlabs.io/v1/models',{headers:{'xi-api-key':cfg.elevenKey},signal:AbortSignal.timeout(12000)})
const data=await r.json()
console.log(JSON.stringify({status:r.status,models:Array.isArray(data)?data.filter(m=>m.can_do_text_to_speech).map(m=>({id:m.model_id,name:m.name,hu:m.languages?.some(l=>l.language_id==='hu'),en:m.languages?.some(l=>l.language_id==='en')})):undefined},null,2))
