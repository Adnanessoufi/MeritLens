# Autonomous improvement run — October 10

User authorization: improve the app using the remainder of the CURRENT five-hour allowance; prioritize the live interview, compare VivaProof, improve the avatar, stronger colors, and add Hungarian. No new paid subscription, no account credit reset, no fabricated production records. The goal remains active until the requested allowance boundary is reached.

## Delivered

- Short introduction; silence/ASR filler never gets an acknowledgment of understanding. Raw answers preserved.
- Source-grounded, response-dependent next questions; fixed transfer task/changed scenario/rubric retained. Failure preserves an answer draft for retry.
- Hungarian student and teacher UI, conversation, TTS/dictation locale, spoken reminders, question translation, generated assessments, and assignment/rubric preparation. Original source code, names and evidence quotes stay intact.
- UD_PR-inspired green/gold brand (blue reverted at the user’s explicit request), meaningful green/amber/red score states, shared typography and density. DM Sans now loads from the project, with its SIL Open Font License included, rather than Google Fonts requests.
- Full desktop meeting stage, equal participant tiles, compact controls, and no unused dark block below the meeting.
- Mouth interior uses Adnane's own photographed teeth; audio-driven motion and periodic gentle smile. Base portrait outside the fixed mouth patch remains pixel-identical. This is still approximate 2D animation.
- Teacher file preparation explicitly preserves individual question points (including eight questions totaling 20) rather than merging them into a 100-point rubric.
- Fixed source-guided fallback that accidentally displayed a code-expression string instead of a real source quote; fixed missing Hungarian sample-question translation; localized reasoning/calculation timing.

## Public comparison informing priorities

VivaProof's public question-generation page describes submission-specific questions and subsequent questions influenced by the response: https://www.vivaproof.com/answers/question-generation
Its interview-style page describes Examiner and Builder styles, including depth/transfer: https://www.vivaproof.com/answers/interview-style
These public descriptions guided the live source/response flow. Their private code, avatar quality, scoring internals, and individual student sessions were not accessed or replicated.

## Validation and limits

The API suite passes 83 checks after the language, weighting and response fixes. Browser checks cover Hungarian forms and persistence, real decoded fixture audio, outside-mouth pixel preservation, silence/non-speech, tab/head warnings, automatic microphone, adaptive deadlines, and desktop navigation. Latest browser rerun/restart status is recorded in SPRINT_CONTEXT.md.

Fixtures are fictional and use a separate in-memory database/port. Existing production SQLite assignments, submissions, deletions and teacher decisions are preserved. No real camera quality or Hungarian speech intelligibility claim follows from mocked browser tests; those need a live human rehearsal. No misconduct verdict is inferred from head direction, device visibility, missing hands, or transfer gaps.

Latest user correction: completion is one column; the student reference uses the smiling/glasses portrait and Student: Adnane Essoufi; the AI-generated interview panel is removed; question speech now explicitly uses plain A2–B1 English. See SPRINT_CONTEXT.md for the latest checks and remaining visual limits.

2026-10-10 correction: The jury's 20 questions were background context, not a product request. Restored standard oral defence to the original adaptive 3-6 turns (maximum 6), removed unrequested length selectors and updated the project template. Active extended sessions retain their answers and use the six-question ceiling; completed evidence is preserved.

Project preparation: docs/PROJECT_DEMO_PREPARATION.md lists likely questions, adaptive follow-ups and deliberately wrong claims to test. Spoken reactions now come from the actual response within the existing AI call, with no added request. Brief neutral reactions precede the question; silence/unknown replies keep their separate handling. English reactions persist on reload and unsafe praise/hints fall back to the existing neutral transition. Genuine fictional QA detected the camera-warning misconception in both answer assessment and report.

2026-10-10 compact reports: removed five report tabs and large strengths/review-area descriptions. Grade, criterion points, interview result rows and PDF download are immediately accessible; transcripts and teacher actions expand on demand. MATLAB, thesis and project rubrics now total 20 each. Existing project scoring was blocked by automatic approval because it would transmit existing student work to configured OpenAI; awaiting explicit authorization. No score was fabricated. PDF and grading API checks plus compact desktop/mobile browser and grade-approval checks passed.

Numeric grade correction: missing/incorrect or unsupported criteria receive zero suggested points, with the original reason retained for teacher correction. Suggested totals always sum numeric criterion scores; old null suggestions are normalized locally. Teacher-approved grades are untouched. Compact report and PDF share the same score calculation. No external grading request is needed for this correction.
The user explicitly authorized the existing project submission to be graded with configured OpenAI. Reassessed and saved AI suggestion: 15/20 (4,6,0,5). The report and PDF were verified to contain the same numeric total. Awaiting-data approval limitation resolved.

2026-10-10: Simplified all generated interview questions, translations and transfer scenarios to short everyday speech. Added question-relative evidence calibration: direct correct factual/value answers can be DEMONSTRATED with reasoning not_required; brief correct reasons count, vague circular claims stay PARTIAL and false claims UNCLEAR. Teacher explanations request one short sentence. Existing transcripts/reports left intact. New simple-answers guard tests plus adaptive/integration/transfer regression suite: 49 passed. Synthetic live OpenAI QA across MATLAB/thesis/public project demo: numeric -3, short reason, plain thesis mechanism and 'The teacher' passed; vague thesis PARTIAL; wrong camera claim UNCLEAR. Verified backup and restarted only port5175. QA artifact .test-artifacts/simple-interview-qa.json.


## 2026-10-10 — agreed interview modes

Standard interviews now ask independent concepts with no follow-up. Prepared source-matched sets use 5 MATLAB, 6 thesis and 6 project questions. Unrelated uploads still receive grounded AI questions. Teachers choose standard or transfer (2/3 explain/apply pairs). Transfer adapts only the application wording, keeps the original changed case, and waits until both replies are recorded before correcting a misconception.

Standard feedback distinguishes silence, uncertainty, partial answers and mistakes. Wrong core answers earn 0/2; a correction does not upgrade the saved answer. Numeric interview scores appear in the report and PDF alongside the separate assignment grade. Final feedback plays before completion and stays visible. Saved reports and submissions are preserved.

Validation: 63 focused regression/behavior tests passed; 23 affected tests passed again after the grading prompt was separated from the legacy adaptive prompt. Frontend build passed. Actual MATLAB/abstract/project source matching passed locally. Live fictional math/classroom checks confirmed wrong y-axis=UNCLEAR, short correct y-axis=DEMONSTRATED and teacher=DEMONSTRATED. Automatic approval rejected exporting source-derived thesis context for extra verification; the check was changed to transmit only hardcoded fictional inputs.

Final checks: all 3 browser cases passed (silent microphone, unintelligible audio, final feedback before completion); all 6 independent-interview tests passed, including saved final feedback audio and stale-ID rejection. Live server restarted on 5175 after a verified SQLite backup (53 submissions, 54 sessions, 175 answers, 46 reports). Existing teacher mode choices were preserved.
