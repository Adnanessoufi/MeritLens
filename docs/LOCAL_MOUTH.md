# Local mouth animation

The default interviewer uses the supplied original `public/assets/adnane-interviewer.jpg` with browser canvas animation. `src/avatar.jsx` returns the local renderer immediately and makes no D-ID requests. Existing D-ID backend endpoints remain available for legacy integrations; their configured-key metadata is not the default frontend renderer.

`src/LipPortrait.jsx` draws the original image without regeneration. Only a small calibrated mouth patch is redrawn; eyes, nose, hair, skin outside the patch and background retain the original decoded pixels. `shared/local-mouth.js` moves the original lip pixels and adds a narrow shaded opening. Zero amplitude restores the original patch exactly. This is a simple 2D audio-reactive mouth, not photorealistic generated video or phoneme/viseme prediction.

`src/voice.js` measures the actual question audio using Web Audio RMS with silence gating and smoothing. Playback/end/stop/replay/unmount reset animation and clean up frames/audio nodes. The photo does not leave the browser for animation. OpenAI question/speech services retain their existing API costs. Browser-native speech has no accessible waveform and currently retains the static portrait.

Verification: production build and `node node_modules/@playwright/test/cli.js test tests/browser/local-lips.spec.js` passed. Chrome decoded a real four-second WAV fixture; camera/reference observations were controlled synthetic outputs. Confirmed moving mouth while audio plays, answer timer starts after audio ends, stop/replay restoration, pixel-identical image outside mouth patch, zero avatar endpoint requests and no page errors. Screenshot `.test-artifacts/screenshots/local-lips-meeting.png`. No paid avatar generation or new models installed.

## October 10 expression update

Audio levels now normalize to recent speech energy, so quiet speech remains visibly animated. A spectral ratio varies rounded/wider mouth shapes; this is approximate expression, not phoneme prediction. The mouth patch adds gentle corner lift during speaking/listening, with the first smile triggered by audible speech rather than photo load. Expressions fade to neutral when activity stops. Eyes/nose/hair/background remain the original pixels; mouth interior shading is a lightweight drawn approximation.

Browser-native speech now uses estimated speech cadence rather than a static mouth, because the browser does not expose its waveform. Recorded-provider playback still follows measured audio. Validation: local-mouth.test.js checks distinct states and neutral restoration; native local-lips browser test checks audible mouth opening, smile, unchanged surrounding pixels, timer, stop/replay and zero D-ID requests.


## Authentic oral texture and desktop stage (October 10)

The mouth interior now samples the teeth and oral cavity from Adnane's original supplied smiling photograph (`public/assets/adnane-interviewer.png`). This is a local canvas effect: no photo upload, paid avatar request, model download, or generated face. Outdoor color is neutralized within that small texture. The frontal portrait still supplies all lip contours, skin, eyes, nose, hair, and background. The existing fixed mouth patch is unchanged; the exact neutral base pixels restore when speech/smile activity stops. A missing texture falls back to the prior interior shading, so a failed optional image load does not stop speech.

This improves the lightweight demo renderer. It remains approximate audio-driven 2D mouth animation, not photorealistic generated video or phoneme-accurate lip synchronization. Browser-native TTS still uses estimated cadence; provider audio uses measured waveform energy. The Linux/CUDA Wav2Lip setup was not installed on this AMD Vega 10/1 GB Windows machine: no unbenchmarked heavy model was made the default.

The meeting now fills the desktop viewport with two equal participant tiles and compact question/answer/control rows. Portrait pixels remain original outside the patch. Genuine camera footage was not needed for engineering verification; browser fixtures use a labeled synthetic camera.
