import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mouthPatch} from '../shared/local-mouth.js'

test('mouth and smile states differ, feather patch boundaries, and return to exact original pixels',()=>{
 const width=80,height=32,source=new Uint8ClampedArray(width*height*4)
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=(y*width+x)*4;source[i]=100+x;source[i+1]=60+y;source[i+2]=50+y;source[i+3]=255}
 const opened=mouthPatch(source,width,height,.9,{roundness:.9})
 const wider=mouthPatch(source,width,height,.9,{roundness:.1})
 const smile=mouthPatch(source,width,height,0,{smile:.8})
 assert.notDeepEqual(opened,source)
 assert.notDeepEqual(opened,wider)
 assert.notDeepEqual(smile,source)
 assert.deepEqual(mouthPatch(source,width,height,0,{smile:0}),source)
 for(const result of[opened,wider,smile]){
  for(let x=0;x<width;x++){assert.deepEqual(result.slice(x*4,x*4+4),source.slice(x*4,x*4+4));const i=((height-1)*width+x)*4;assert.deepEqual(result.slice(i,i+4),source.slice(i,i+4))}
  for(let i=3;i<result.length;i+=4)assert.equal(result[i],255)
 }
})

test('authentic mouth texture affects only the oral cavity and neutral pixels restore exactly',()=>{
 const width=80,height=32,source=new Uint8ClampedArray(width*height*4).fill(120)
 for(let i=3;i<source.length;i+=4)source[i]=255
 const texture={width:8,height:4,data:new Uint8ClampedArray(8*4*4).fill(220)}
 const a=mouthPatch(source,width,height,.9,{texture}),b=mouthPatch(source,width,height,.9)
 assert.notDeepEqual(a,b)
 assert.deepEqual(mouthPatch(source,width,height,0,{texture}),source)
 for(let x=0;x<width;x++)assert.deepEqual(a.slice(x*4,x*4+4),source.slice(x*4,x*4+4))
})
