import {useEffect,useRef} from 'react'
export function useInterviewPresence(session){
 const latest=useRef(session);latest.current=session
 useEffect(()=>{
  if(!session||!['active','held'].includes(session.status))return
  const id=session.id
  const body=departing=>{const s=latest.current;let draftText='';if(s?.question?.id)draftText=sessionStorage.getItem('merit-lens-draft:'+id+':'+s.question.id)||'';return{departing,questionId:s?.question?.id,draftText}}
  const heartbeat=()=>fetch('/api/sessions/'+id+'/presence',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body(false)),keepalive:true}).catch(()=>{})
  const leave=()=>{const s=latest.current;if(!s||!['active','held'].includes(s.status))return;const payload=new Blob([JSON.stringify(body(true))],{type:'application/json'});if(!navigator.sendBeacon?.('/api/sessions/'+id+'/presence',payload))fetch('/api/sessions/'+id+'/presence',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body(true)),keepalive:true}).catch(()=>{})}
  heartbeat();const timer=setInterval(heartbeat,5000);window.addEventListener('pagehide',leave)
  return()=>{clearInterval(timer);window.removeEventListener('pagehide',leave);leave()}
 },[session?.id,['active','held'].includes(session?.status)])
}
