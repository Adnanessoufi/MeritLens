import React, { useEffect, useRef } from 'react'
import { mouthPatch } from '../shared/local-mouth.js'

// Original pixels everywhere except a small, fixed mouth patch.
export default function LipPortrait({ level, pose, speaking, listening }) {
  const canvas = useRef(null)
  const activity=useRef({speaking,listening}); activity.current={speaking,listening}
  useEffect(() => {
    const node = canvas.current, context = node.getContext('2d')
    const photo = new Image()
    let alive = true, frame, source, bounds, texture, previous = "", last = 0, warmBegan=0, smoothSmile=0, heard=false, wasSpeaking=false, wasListening=false
    const smilePhoto=new Image()
    smilePhoto.onload=()=>{
      if(!alive)return
      const sample=document.createElement('canvas');sample.width=160;sample.height=48
      const sampling=sample.getContext('2d',{willReadFrequently:true})
      // Correct the mild tilt in the authentic smiling photograph. No image is uploaded.
      sampling.translate(80,24);sampling.rotate(-.10)
      sampling.drawImage(smilePhoto,326,383,118,38,-80,-24,160,48)
      texture=sampling.getImageData(0,0,160,48)
      // Neutralize outdoor lighting while retaining natural photographed tooth detail.
      for(let i=0;i<texture.data.length;i+=4){
        const r=texture.data[i],g=texture.data[i+1],b=texture.data[i+2],l=r*.25+g*.6+b*.15
        texture.data[i]=l*.94+(r-l)*.25
        texture.data[i+1]=l*.93+(g-l)*.25
        texture.data[i+2]=l*.94+(b-l)*.25
      }
      previous='';node.dataset.mouthTexture='photographed'
    }
    smilePhoto.src='/assets/adnane-interviewer.png'
    photo.onload = () => {
      if (!alive) return
      node.width = photo.naturalWidth; node.height = photo.naturalHeight
      context.drawImage(photo, 0, 0)
      bounds = { x: Math.round(node.width * .39), y: Math.round(node.height * .611), width: Math.round(node.width * .23), height: Math.round(node.height * .074) }
      source = context.getImageData(bounds.x, bounds.y, bounds.width, bounds.height)
      node.style.opacity = '1'
      const update = time => {
        if (!alive) return
        if (time - last >= 33) {
          last = time
          const amount = Math.round(Math.max(0, Math.min(1, level?.current || 0)) * 20) / 20
          const current=activity.current
          if(current.speaking&&!wasSpeaking)heard=false
          if(current.speaking&&amount>0&&!heard){heard=true;warmBegan=time}
          if(current.listening&&!wasListening)warmBegan=time
          wasSpeaking=current.speaking;wasListening=current.listening
          const t=(time-warmBegan)/1000,cycle=t%10
          const warm=(current.speaking&&heard)||current.listening
          const targetSmile=warm&&cycle<2?Math.sin(cycle/2*Math.PI)*.7:0
          smoothSmile=smoothSmile*.7+targetSmile*.3
          const smile=Math.round(smoothSmile*20)/20
          const roundness=Math.round((pose?.current?.roundness||0)*10)/10
          const key=[amount,smile,roundness].join(':')
          if(key!==previous){
            previous=key
            context.putImageData(new ImageData(mouthPatch(source.data,bounds.width,bounds.height,amount,{smile,roundness,texture}),bounds.width,bounds.height),bounds.x,bounds.y)
            node.dataset.mouthLevel=String(amount)
            node.dataset.smileLevel=String(smile)
            node.dataset.mouthShape=String(roundness)
          }
        }
        frame = requestAnimationFrame(update)
      }
      frame = requestAnimationFrame(update)
    }
    photo.src = '/assets/adnane-interviewer.jpg'
    return () => { alive = false; cancelAnimationFrame(frame); photo.onload = null; smilePhoto.onload=null }
  }, [level,pose])
  return <canvas ref={canvas} className="local-lip-portrait" aria-label="Adnane photo with local lip animation" data-speaking={speaking ? 'true' : 'false'} />
}
