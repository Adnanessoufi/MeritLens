# Talking photo interviewer

D-ID animates the supplied Adnane portrait. OpenAI/ElevenLabs generates the question audio; that exact audio is uploaded to D-ID and embedded in the rendered video. This is a generated presenter, not live footage or a clone of Adnane's voice.

## Setup and demo

1. Set `D_ID_API_KEY` in `.env` using the API key from D-ID Studio. A value copied with `Basic ` is accepted. Keep it server-side; never use `VITE_`.
2. Select OpenAI or ElevenLabs voice. Browser-only speech cannot supply an audio file for lip sync.
3. Run `npm run build`, then restart the app. The teacher connection panel reports avatar configuration; it does not claim an unchecked key is verified.
4. Upload work. On the camera setup screen, the current question's avatar begins rendering. Wait for **Talking Adnane is ready** for the smoothest demonstration.
5. Start the interview. The video includes the question's voice; the answer timer starts on video `ended`. Listen Again replays the same clip without another generation. See Question stops playback and starts the normal reading/answer flow. A video that finishes rendering afterward will not interrupt that response.
6. If the service or playback fails, choose the explicit voice-only option or reveal the question. Each new question gets its own choice and video.

The portrait and current question audio are sent to D-ID. Student camera frames and student answers are never included in avatar requests. Submission-specific question content may contain excerpts of the work. Existing analysis/transcription services retain their existing disclosure. Camera setup and its small unavailable-device exception are unchanged; camera signals never grade understanding.

## Engineering limits

This integration uses D-ID's supported photo-to-video `/talks` path. It is question-by-question generation, not a realtime avatar conversation. The legacy photo WebRTC stream endpoint is deprecated and was deliberately avoided. Typical documented rendering latency is 10–30 seconds; observed greeting rehearsal was about 20 seconds. Video renders are paid provider operations. Preparation is deduplicated within the server process and bounded to 64 cached jobs. Refresh and Listen Again reuse the question job; server restarts clear this cache. D-ID result URLs expire after 24 hours; cached jobs expire conservatively after 20 hours. This local demo does not persist every paid question video across restarts. Do not restart between repeated rehearsals unnecessarily.

Only the active question can start or retrieve a job. Unseen transfer application questions remain gated behind the first committed response. No arbitrary client text/photo URL is accepted, and no student identifier is sent as provider metadata. Failed credentials/quota/image acceptance are shown clearly. No automatic paid regeneration on errors. An explicit retry resumes an existing talk when possible rather than creating another paid clip. A retry after a definitive failed talk or before a provider talk ID was returned may initiate a new render.

## Verification

`npm test` covers disabled/keyless behavior, current-question gating, secret redaction, portrait/audio upload, deduplication, shared speech cache, timer neutrality and rejected credentials. Browser avatar tests use a clearly synthetic video and camera to exercise actual media playback, replay, late readiness and question-specific voice fallback. Camera regression checks exercise denial, disconnection/draft retention and late permission results.

`node --env-file-if-exists=.env scripts/avatar-rehearsal.js` is an opt-in real-provider greeting test that uses D-ID/OpenAI credits and the supplied portrait. It saves a playable MP4 plus a safe receipt under `.test-artifacts`. `TEST_LIVE_AVATAR=1` enables `tests/browser/avatar-live.spec.js`, which uses the production app on 5175 and creates an explicitly fictional submission. It verifies a real D-ID question video, actual browser decoding, answer timer, and laptop fit. It uses a synthetic student camera rather than hardware access.

Official provider contracts: https://docs.d-id.com/docs/v2-photo-avatar-quickstart , https://docs.d-id.com/reference/upload-an-image , https://docs.d-id.com/reference/upload-an-audio , https://docs.d-id.com/reference/createtalk , https://docs.d-id.com/reference/gettalk .

## Replacing the portrait

The current portrait is the user-supplied photo Adnane ESSOUFI.jpg, copied unchanged to public/assets/adnane-interviewer.jpg. To swap another JPEG, replace that one asset, build, and restart the app to clear uploaded-photo and rendered-video caches. No provider-key change or feature rewrite is needed. The older smiling portrait is retained as an inactive rollback asset.

## Likeness controls

The current photo profile uses documented stitch:true, fluent:false and a neutral expression with intensity 0. Stitching retains original framing/background; it does not promise unchanged facial pixels. Mouth and face are still reconstructed by the provider, so the user must judge likeness. A real before/after clip was decoded and compared at the same timestamp in Chrome (avatar-likeness-comparison.png); the current account accepted these controls. A new account may lack stitching permission, in which case the explicit avatar error/fallback applies. For better personal likeness, consider a video-based avatar using a consented real recording rather than promising that photo settings remove all distortion.
