import React,{useEffect,useState} from 'react'
import {loadReferenceFaceEngine} from './reference-face.js'
export function useReferenceFace(camera) {
 const [state,setState]=useState({status:'off'}),[version,setVersion]=useState(0)
 useEffect(()=>{loadReferenceFaceEngine().catch(()=>{})},[])
 useEffect(()=>{
  if(!camera.ready){setState({status:'off'});return}
  let alive=true,pending=false,engine,timer,watchdog,matches=0,sequence=0
  const video=document.createElement('video');video.muted=true;video.playsInline=true;video.srcObject=camera.streamRef.current
  setState({status:'loading'})
  function unavailable(){if(alive)setState({status:'unavailable'})}
  watchdog=setTimeout(unavailable,45000)
  video.play().catch(unavailable)
  loadReferenceFaceEngine().then(value=>{if(!alive)return;engine=value;clearTimeout(watchdog);setState({status:'checking'})}).catch(unavailable)
  timer=setInterval(async()=>{
   if(!alive||!engine||pending||video.readyState<2||document.hidden)return
   pending=true
   try{
    const result=await engine.compare(video)
    if(!alive)return
    matches=result.status==='candidate-match'?matches+1:0
    setState({sampleId:++sequence,status:result.status==='candidate-match'?(matches>=2?'matched':'checking'):result.status})
   }catch{unavailable()}finally{pending=false}
  },1000)
  return()=>{alive=false;clearInterval(timer);clearTimeout(watchdog);video.pause();video.srcObject=null}
 },[camera.ready,version])
 return {...state,retry:()=>setVersion(v=>v+1)}
}
export function ReferenceFaceCheck({identity,onReview,approved}) {
 const labels={off:'Enable camera first',loading:'Loading local reference check…',checking:'Comparing your face locally…',missing:'No usable face detected · look toward the camera',multiple:'Keep one face in the frame',matched:'Face matches this photo','review-required':'Reference comparison needs teacher review',unavailable:'Reference comparison unavailable · teacher review required'}
 return <section className="reference-check"><img src="/identity/reference-glasses.png" alt="Adnane Essoufi student photo"/><div><strong>Student: Adnane Essoufi</strong><p role="status">{approved?'Teacher approved this identity check':labels[identity.status]}</p>{['review-required','unavailable','multiple','missing'].includes(identity.status)&&!approved&&<button className="text-button" onClick={onReview}>Ask teacher to verify</button>}</div></section>
}
