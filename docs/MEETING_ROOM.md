# Meeting-room demo

The interview defaults to a compact meeting room: interviewer video and local student camera tiles, the current question, a fixed response countdown, and a call control bar. No central microphone orb, giant focus counter, or repeated explanation blocks. The default demonstration window is 10 seconds; preflight offers 20/30/45/60 seconds. Unchecking Meeting room preserves the previous guided interview, useful for inspecting long answers and existing demonstrations.

## Live flow

Enable camera, calibrate the normal starting head position, optionally confirm hand framing, and enable Automatic microphone. Join requests microphone permission before entering. The question video/voice plays first. Once it ends, the timer starts and the microphone opens automatically. At the deadline, recording stops, transcription finishes, and the response is saved before the next question. Typed answers also save at the deadline. Finishing speech manually can advance early. Transcription failures remain visible with retry/typing; they are not silently replaced by a successful result.

The 10-second window is a fast demo setting, not a universal appropriate assessment duration. Teacher/presenter should use a longer window for substantial reasoning or accommodations. Understanding still depends on the answer's meaning, not elapsed time or camera geometry. The transfer challenge remains four/six staged turns with its original/application scoring isolation.

## Warnings and review

- First actual tab departure (document visibility, not camera permission dialog/window blur): spoken reminder and three seconds to return. The deadline is persisted server-side; returning late or reloading cannot clear it.
- Second departure: stop the meeting for human review.
- Sustained head turn, missing face, or missing previously framed hands: spoken framing reminder and a visible modal. Camera checks do not identify what the student is looking at or establish cheating. The same repeated framing issue places the meeting on hold.
- The answer window pauses during reminders; warning state and counts survive refresh. Voice/video/recording stop while interrupted. Camera setup/recalibration and hand visibility keep their prior local-processing constraints.
- Held attempts preserve saved answers and the current transcript/draft. Teacher queue includes Review stopped meeting; reviewer reads saved responses/draft, checks circumstances and any identity concern with the student, and writes a visible explanation before resuming or closing the attempt. Resume keeps the question, resets warning counters and gives a fresh response window. Close produces a partial report for ordinary review. A slow evaluation cannot overwrite a hold or subsequent teacher resume.

No automatic disqualification or face–ID classification is implemented. Identity remains explicitly unverified until a human checks an ID with the student. Looking down, outside-frame hands and landmark error are not proof of misconduct. These are procedural review holds, not automatic academic eligibility/pass/fail decisions. Teacher/Student are still prototype demo roles without authentication; this is not tamper-proof proctoring.

## Voice and avatar limits

Questions use the existing D-ID photo-video pipeline, with per-question rendering latency. Reminders use the selected synthetic voice via the server without waiting for a new avatar video. Reminder audio can be blocked by browser autoplay/provider availability; visible messages remain. The reminders do not claim immediate lip synchronization. Camera frames stay local; recorded answers use the existing disclosed transcription provider.

## Verification

Six meeting API tests cover fixed 10-second transfer turns, immutable refreshed deadlines, deduplicated tab warnings/three-second cutoff, human resume/end, preserved draft, slow-evaluation concurrency, and persisted camera reminder/pause. Browser meeting checks cover laptop fit, timed typed responses, spoken reminder/return/second departure, repeated head-position warnings, draft review/resume, and automatic microphone turns using synthetic media. Existing complete-interview, recorded-audio and camera-reconnect checks are retained. Actual hardware permissions remain a presenter check.

Continuous-monitoring correction: camera rules apply throughout the joined meeting, including while D-ID prepares or plays a question. The earlier response-only phase gate has been removed for meeting mode. A local visible-phone detector now produces a possible-phone reminder after three seconds; repeat holds for human review. It only sees objects in the camera frame and may miss obscured/small devices. The actual bundled model was validated on one clearly visible COCO phone image; a mostly occluded phone was missed and is documented as a limitation. No claim of detecting all cheating or matching identity.

Latest entry flow: meeting is mandatory, student timing/room/microphone checkboxes are removed, and response windows adapt per question (12–25 seconds). Join stays disabled until a visible calibrated face and the local supplied-reference comparison pass. A small microphone-unavailable typing option remains. Inconclusive identity comparisons require teacher review; no automatic disqualification or official-ID claim. See REFERENCE_FACE.md for the fixed Adnane demo reference, privacy, tests and limitations.
