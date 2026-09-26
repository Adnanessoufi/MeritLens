# Merit Lens

A working hackathon MVP for understanding checks through short oral defences. It is **not an AI detector**. Teachers review the evidence and make the final judgment.

## Run locally

Requires **Node.js 22.18 or later** (built-in SQLite) and npm.

```sh
npm install
npm run dev
```

Open **http://127.0.0.1:5173**. One process serves both the React/Vite frontend and Express API. Start with **I'm a student → Use a sample assignment**, or open the teacher workspace to create an assignment.

For a production build served locally:

```sh
npm run build
npm start
```

The initial database includes one sample Python assignment and three teacher-approved questions. It does not include fabricated student submissions.

## Enable live AI and ElevenLabs voice

Copy `.env.example` to `.env` and fill in your own keys locally:

```dotenv
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-4.1-mini
ELEVENLABS_API_KEY=your_key_here
ELEVENLABS_VOICE_ID=JBFqnCBsd6RMkjVDRZzb
ELEVENLABS_TTS_MODEL=eleven_multilingual_v2
ELEVENLABS_STT_MODEL=scribe_v2
DEMO_MODE=auto
```

Restart the server after changes. **Never prefix keys with `VITE_` or put them in React files.** `.env` and the database directory are git-ignored. All provider calls happen on the server, using native `fetch`; keys are never returned to the browser. Change the model or voice ID if your account uses a different available model or voice.

Modes:

| Configuration | Understanding analysis | Voice |
| --- | --- | --- |
| No keys | Clearly labeled local demo rules | Browser speech synthesis and browser dictation, where supported |
| OpenAI key | Real concept extraction, evaluation, adaptive follow-ups, and report synthesis | Browser voice unless ElevenLabs is configured |
| OpenAI + ElevenLabs keys | Real OpenAI analysis | ElevenLabs question audio and recorded-answer transcription |
| `DEMO_MODE=true` | Always local illustrative analysis | ElevenLabs if configured, otherwise browser voice |
| `DEMO_MODE=false` without a key | Explicit configuration error | No silent replacement with demo evaluations |

**Demo classifications are not a valid assessment.** The demo matches teacher concepts/source passages and uses response length only to illustrate the three report states. Both the student flow and teacher reports label this. Live mode evaluates meaning against the cached assignment analysis. Provider errors in live mode remain errors with retry controls; they never silently become demo evidence.

Use Chrome or Edge for browser dictation. Browser speech support and network requirements vary. Denied microphone permissions, unavailable speech services, or blocked autoplay always leave **See Question** and the typing fallback available. Live recording requires a secure context: localhost works; a remote deployment needs HTTPS. Browser dictation may use the browser vendor's speech service. With ElevenLabs configured, audio is sent to ElevenLabs; assignments/answers are sent to OpenAI in live mode. Raw microphone audio is kept transiently for transcription and retry, not stored in SQLite.

## Working flow

1. **Teacher:** create an assignment with a brief and optional core concepts. Generate suggestions, edit/approve/delete them, or add your own approved questions. Copy the student link.
2. **Student:** choose the assignment, enter a name, and submit PDF, DOCX, UTF-8 TXT, or pasted text. Extraction is real in both modes.
3. **Analyze once:** store the extracted text and one structured analysis with concepts, source excerpts, methods, claims, sections, and initial questions. An upload request ID prevents duplicate analysis on retries.
4. **Defend:** questions are spoken by default; text stays hidden until **See Question**. Speak, review the transcript, and send it; typing is also available. Relevant teacher-approved questions take priority. After an answer, ask a deeper question, clarification, or simpler explanation, then cover another concept.
5. **Stop:** finish after at least three responses and three available concepts have been checked, or after six questions. When fewer concepts exist, ask at least three questions. Empty analysis uses generic understanding questions.
6. **Report:** save all questions, transcripts, timings, statuses, explanations, strengths, and review areas. The teacher dashboard links to each completed report. Failed report generation preserves all answers and can be retried by the teacher or student.

The 60-second timer starts when audio finishes playing or the question is revealed, whichever happens first. Replaying does not reset it. Start/end timestamps are server-recorded and survive refresh. For voice, response time ends when recording stops, before transcription; for text, when the answer reaches the server. Re-recording resumes the original timer. Evaluation and report-generation latency are excluded. Timer expiry is recorded, but does not interrupt the student or affect their understanding status. Recordings stop after two minutes to bound audio size. Transcripts can be corrected before sending.

## Limits and storage

- PDF/DOCX/TXT uploads: **10 MB**; extracted/pasted text: **60,000 characters**. Oversized text is rejected rather than silently truncated.
- PDFs must contain readable text. OCR for scanned documents is outside this MVP; paste the text instead.
- SQLite defaults to `data/merit-lens.sqlite`. Assignments, questions, submissions, analyses, sessions, answers, and reports persist across restarts. Set `DATABASE_PATH` to change its location.
- Active sessions can be resumed using their URL. Already-submitted answers are saved; unfinished draft text is held only in the current browser tab.
- Sessions snapshot their question bank. Later teacher edits apply to new sessions.
- Teacher and Student are **demo roles, not authentication**. Run locally for the hackathon. The server binds to `127.0.0.1` by default; links work on the same machine. Do not expose real student records publicly without adding authorization and suitable data handling.
- No payments, admin features, grades, authorship scores, or automatic misconduct verdicts.

## Structure

```text
src/
  App.jsx          App shell, landing page, simple hash navigation
  Student.jsx      Upload, voice-first defence, completion
  Teacher.jsx      Dashboard, question review, evidence report
  voice.js         Speech playback, recording, browser fallback
  api.js           API helper and resource loading
  components.jsx   Small shared components and SVG icons
  styles.css       Responsive plain CSS
server/
  index.js         Single development/production server
  app.js           API routes and validation
  db.js            SQLite schema and sample assignment
  ai.js            OpenAI structured outputs and explicit demo provider
  flow.js          Question selection and report persistence
  extract.js       PDF/DOCX/TXT extraction
  config.js        Server environment configuration
tests/
  integration.test.js  End-to-end API and provider contract tests
  browser/flow.spec.js Browser interaction and responsive checks
```

## Verify

```sh
npm test
npm run build
npm run test:ui
```

Browser checks use installed Google Chrome, a separate local server on port 5184, and an in-memory database. They do not change your normal app data. If Chrome is unavailable, install it or change the Playwright channel configuration. Screenshots/traces are saved under `.test-artifacts/`. Tests cover real document extraction, the complete teacher/student flow, retry/idempotency, timer evidence, persistence, and provider request/response contracts. Browser audio and microphone events are simulated in automation; **live provider credentials and physical microphone/audio quality require a manual check**.

Integration references: [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [ElevenLabs text to speech](https://elevenlabs.io/docs/api-reference/text-to-speech/convert), and [ElevenLabs speech to text](https://elevenlabs.io/docs/api-reference/speech-to-text/convert).
