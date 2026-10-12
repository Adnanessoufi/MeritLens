/* Local MediaPipe worker. Only small geometry summaries return to the UI. */
importScripts('/vision/vision_bundle.js')
let face, hands, files, phones, phoneReady = false
async function init() {
  files = await Vision.FilesetResolver.forVisionTasks('/vision/wasm')
  face = await Vision.FaceLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: '/vision/face_landmarker.task', delegate: 'CPU' }, runningMode: 'VIDEO', numFaces: 1, minFaceDetectionConfidence: .6, minFacePresenceConfidence: .6, minTrackingConfidence: .6, outputFaceBlendshapes: false, outputFacialTransformationMatrixes: true })
  try { phones = await Vision.ObjectDetector.createFromOptions(files, { baseOptions: { modelAssetPath: '/vision/phone_detector.tflite', delegate: 'CPU' }, runningMode: 'VIDEO', scoreThreshold: .45, categoryAllowlist: ['cell phone'], maxResults: 3 }); phoneReady = true } catch { phoneReady = false }
  postMessage({ type: 'ready' })
}
onmessage = async ({ data }) => {
  try {
    if (data.type === 'init') return await init()
    if (data.type !== 'frame' || !face) { data.frame?.close(); return }
    try {
      if (data.hands && !hands) hands = await Vision.HandLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: '/vision/hand_landmarker.task', delegate: 'CPU' }, runningMode: 'VIDEO', numHands: 2, minHandDetectionConfidence: .6, minHandPresenceConfidence: .6, minTrackingConfidence: .6 })
      const result = face.detectForVideo(data.frame, data.timestamp)
      const landmarks=result.faceLandmarks?.[0]
      const distance=(a,b)=>Math.hypot(landmarks[a].x-landmarks[b].x,landmarks[a].y-landmarks[b].y)
      const mouthWidth=landmarks?.length>291?distance(61,291):0
      const eyeWidth=landmarks?.length>291?distance(33,263):0
      const mouth=mouthWidth>.01&&eyeWidth>.01?{opening:distance(13,14)/mouthWidth,stretch:mouthWidth/eyeWidth}:null
      const matrix = result.facialTransformationMatrixes?.[0]?.data
      const pose = matrix?.length === 16 ? { yaw: Math.atan2(matrix[8], matrix[10]) * 180 / Math.PI, pitch: Math.atan2(-matrix[9], Math.hypot(matrix[8], matrix[10])) * 180 / Math.PI } : null
      const count = data.hands ? hands.detectForVideo(data.frame, data.timestamp).landmarks.length : null
      let phone = null
      if (phoneReady) { try { phone = phones.detectForVideo(data.frame, data.timestamp).detections.some(d => d.categories.some(c => c.categoryName === 'cell phone' && c.score >= .45)) } catch { phoneReady = false } }
      postMessage({ type: 'result', phone, phoneReady, mouth, face: result.faceLandmarks.length > 0, pose, hands: count, timestamp: data.timestamp })
    } finally { data.frame.close() }
  } catch { postMessage({ type: 'error' }) }
}
