# Camera observations

Merit Lens now runs local camera geometry checks in a Web Worker during the oral interview. This observes visible head orientation and face/hand detections, not concentration, emotions, identity, cheating or what the student is viewing. Observations never enter the understanding scorer or change understanding labels. They appear as supporting context in the teacher's Transcript & timing section.

## Presenter sequence

1. Upload work, then enable the camera. The vision runtime/models are bundled under /vision and require no external vision API key.
2. Look at the screen and hold still for about two seconds. The system estimates your starting head position. Recalibrate after adjusting camera position. Calibration does not block starting the interview.
3. Start the interview. After the question finishes (or you reveal it), sustained face loss or a head turn causes a small camera indicator. Brief turns under three seconds produce no saved observation. Events are summaries tied to the delivered question.
4. Optional hands: select Check hands in frame only with a desk view. Show both hands briefly to establish that the camera can see them. Only then does sustained zero-hand detection create a hand-visibility observation. The hand check is disabled during typed answers. Missing detections do not prove physical absence.
5. Return to the normal camera position to finish the current event, or finish/change the answer. Review the report's Transcript & timing tab. The camera summary and expanded event timeline show durations and question numbers. Long episodes are emitted in 15-second chunks. Durations can overlap, and totals are not an attention score.

## Local data flow

The existing camera stream is reused; no second permission prompt or extra camera is opened. An offscreen video supplies at most five frames per second to a local classic worker, with only one inference in flight. MediaPipe returns geometry; the worker immediately releases each bitmap. No raw frames, face meshes, iris positions or face embeddings are sent to the API or saved. The worker outputs only face-detected boolean, head-pose estimate and optional 0–2 hand detections. Facial blendshape output is disabled. Processing stops when the camera disconnects or the interview view ends.

The server accepts only bounded summaries: event type, delivered question id, response phase, direction and 3–300-second duration; it assigns the question number. Invalid future questions, arbitrary image data and hand observations during typing are rejected. API records are browser-reported and can be altered by a prototype client; they are not forensic proof. Only camera-calibration/availability setup events are recorded outside answer phases. Page visibility remains its separate existing signal.

## Thresholds and limitations

Calibration uses ten stable approximately frontal samples. Sustained head changes use 28 degrees yaw or 22 degrees pitch relative to calibration; these are initial demo heuristics, not validated gaze or attention thresholds. Glasses, occlusion, low lighting, camera placement and landmark/model error can produce inaccurate or missing detections. The camera cannot see outside its frame. Framing and visibility should be checked on the actual presentation laptop. Recalibrate after moving the device. If local model loading or inference fails, the app reports Checks unavailable and the interview continues with ordinary camera preview. Camera-unavailable fallback continues to work.

Tracking gaps over 1.5 seconds flush the last observed interval; hidden-tab time is not charged as a camera episode. Only response phases are recorded; video-question playback, evaluation and transcription are excluded. Frames captured under a previous question/phase are discarded at the phase boundary.

## Assets and reproduction

Pinned @mediapipe/tasks-vision 1.1.0 (Apache-2.0) supplies the self-hosted runtime/WASM. Official face and hand bundles are stored in public/vision; manifest.json records their upstream URLs, exact byte sizes and SHA256 hashes. `node scripts/prepare-vision.js` refreshes/copies assets; npm run build bundles them into dist. Keep the current checked-in assets for offline demo use rather than requiring the presenter to download them.

Official contracts: https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker/web_js and https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker/web_js .

Validation: four dedicated tracker/API tests exercise short-glance suppression, meaningful sustained events, gap/question boundaries, hand framing, typing exclusions, summary-only validation, deduplication and identical understanding grading with/without camera events. Browser tests run the actual self-hosted face/hand models on a clearly synthetic stream of a supplied portrait (no hardware camera needed), detect sustained face loss, verify report attribution, and separately control model outputs for reproducible head/hand/typing integration checks. Existing camera denial/reconnect/pending-request regressions pass. This bounded setup verifies the pipeline; it does not establish real-world gaze accuracy.

Completion detail: a last-question episode may flush just after the final answer response arrives. The API accepts that final-question summary for up to ten seconds after completed_at, then closes capture. This is bounded cleanup context; it never regrades or rewrites the understanding report. A dedicated fifth camera test covers this grace period.

## Continuous meeting monitoring and visible phones

Meeting-room observations now cover preparation, question playback, speaking, typing and evaluation after Join; the earlier answer-only gate caused the missed warning visible in the user's screenshot. Reminders/holds and hidden tabs still suspend incident accumulation. Guided mode keeps its previous response-only behavior. Hands remain excluded while typing. Head/phone dwell is maintained across phase transitions within a question.

A bundled MediaPipe Object Detector (EfficientDet-Lite0 uint8, official Google model) adds possible cell-phone observations at confidence >=0.45 sustained for 3 seconds. It runs locally in the same worker; images and phone contents are not uploaded or read. Its availability is shown in the camera tile. A first possible-phone observation shows/speaks a reminder; the same repeated observation holds for teacher review. Model readiness is separate from face monitoring so a phone-model failure does not disable face checks.

Validation: the actual local model detected the clearly visible phone in public COCO val2014 image 203879. It did not detect the almost completely hand-occluded device in image 119876; this is a retained limitation, not proof that no phone exists. Test photos are private validation artifacts under .test-artifacts/vision-fixtures, not product gallery content. Controlled-output browser checks reproduce downward-head warnings during an indefinitely preparing avatar and possible-phone warning/repeat hold in that same phase. All 55 API/tracker checks passed. Local phone-model manifest includes source URL, exact byte count and SHA256. Reproduction: scripts/prepare-phone-vision.js (also called by prepare-vision.js).

This is not a guarantee of detecting phone use: out-of-frame, occluded, small/angled devices and low lighting can be missed. Geometry/object predictions do not establish cheating. No automatic identity match or disqualification is introduced.
