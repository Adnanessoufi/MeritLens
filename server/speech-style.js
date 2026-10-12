// Delivery cues are provider-only and never become student/report text.
export function offTopicSpeechParts(text,options={}){
 const prefix=options.delivery?.kind==='off-topic'?options.delivery.playfulPrefix:''
 if(typeof prefix!=='string'||!prefix.trim()||prefix.length>180||!text.startsWith(prefix))return null
 let serious=text.slice(prefix.length).trim(),tail=''
 if(typeof options.neutralTail==='string'&&options.neutralTail.trim()&&serious.endsWith(options.neutralTail)){
  tail=options.neutralTail;serious=serious.slice(0,-tail.length).trim()
 }
 if(!serious)return null
 return {playful:prefix,serious,tail}
}
export function elevenLabsStyledText(text,model,options={}){
 const parts=offTopicSpeechParts(text,options)
 if(!parts||!/^eleven_v(?:3|4)(?:_turbo)?$/.test(model||''))return text
 return '[playful] '+parts.playful+'\n[serious] '+parts.serious+(parts.tail?'\n[calm] '+parts.tail:'')
}
