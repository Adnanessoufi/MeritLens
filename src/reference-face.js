// One-to-one local reference comparison, not a people-search or ID-document service.
export const REFERENCE_DISTANCE_THRESHOLD = 0.6
let enginePromise
export async function loadReferenceFaceEngine() {
 if(!enginePromise)enginePromise=(async()=>{
  const faceapi=await import(/* @vite-ignore */ '/identity/face-api.esm.js')
  try {await faceapi.tf.setBackend('webgl')}catch{await faceapi.tf.setBackend('cpu')}
  await faceapi.tf.ready()
  await Promise.all([faceapi.nets.tinyFaceDetector.loadFromUri('/identity/models'),faceapi.nets.faceLandmark68TinyNet.loadFromUri('/identity/models'),faceapi.nets.faceRecognitionNet.loadFromUri('/identity/models')])
  const options=new faceapi.TinyFaceDetectorOptions({inputSize:416,scoreThreshold:.5})
  const references=[]
  for(const url of ['/identity/reference.jpg','/identity/reference-glasses.png']){
   const image=new Image();image.src=url;await image.decode()
   const result=await faceapi.detectSingleFace(image,options).withFaceLandmarks(true).withFaceDescriptor()
   if(result)references.push(result.descriptor)
  }
  if(!references.length)throw Error('No usable reference face')
  return {
   async compare(input){
    const candidates=await faceapi.detectAllFaces(input,options).withFaceLandmarks(true).withFaceDescriptors()
    if(candidates.length!==1)return {status:candidates.length?'multiple':'missing'}
    const distance=Math.min(...references.map(reference=>faceapi.euclideanDistance(reference,candidates[0].descriptor)))
    return {status:distance<=REFERENCE_DISTANCE_THRESHOLD?'candidate-match':'review-required',distance}
   },
  }
 })().catch(error=>{enginePromise=null;throw error})
 return enginePromise
}
