# Merit Lens

I made Merit Lens to help teachers check if students really understand the work they submit.

The student uploads their work, answers a short oral defence based on it, and the teacher reviews the answers and final report. It checks understanding. Camera warnings do not prove cheating.

**Project website:** https://meritlens.netlify.app/

The website above explains the idea. The full application is inside this repository and runs locally.

![Merit Lens](screenshots/landing-desktop.png)

## What it does

- Teacher creates an assignment, uploads instructions and sets grading criteria
- Points already written in an assignment PDF can be used without a separate grading file
- Student uploads a document, code file or pasted text
- Standard mode asks independent questions about the work
- Challenging mode asks the student to explain an idea, then apply it to a changed situation
- Questions use simple language and can be spoken using ElevenLabs or OpenAI
- Student can answer by voice or text
- Teacher sees the assignment grade, interview answers and paired results, and can download a PDF report
- Hungarian is available for the interface, questions, voice and report; original uploaded work and answers keep their original language

The demo includes MATLAB practice, a thesis defence and a project description. These examples use the agreed question sets. Other submissions use questions generated from their content. In challenging mode, a wrong or missing explanation skips its application question.

The number-of-questions dropdown is a visual demo control, with Adaptive selected first. It does not change interview length. Teachers can still choose two or three concept pairs for challenging mode.

## Technologies I used

For the frontend, I used React and Vite.

For the backend, I used Node.js, Express and SQLite. I also used OpenAI for analysis and transcription, ElevenLabs for voice, MediaPipe for local camera checks, and Playwright for testing.

The interviewer uses a local photo animation that reacts to speech. It is a simple 2D effect. Student camera images stay on the device; only observation events are saved. Recorded answers go to the selected transcription provider.

## Run it

You need Node.js 22.18 or newer.

```bash
npm ci
npm run dev
```

Then open:

```text
http://127.0.0.1:5175
```

For the built app:

```bash
npm run build
npm start
```

Port 5175 is the default. You can change it in `.env`.

## API keys

Copy the example file:

```bash
cp .env.example .env
```

On Windows PowerShell, use `Copy-Item .env.example .env`.

Then add your own OpenAI and ElevenLabs keys inside `.env`. Choose the voice provider in the teacher settings, or set `VOICE_PROVIDER` and `ELEVENLABS_VOICE_ID` in `.env`. Restart the server after changing environment settings.

I do not keep the real API keys inside GitHub. Without an OpenAI key, the app uses local practice evaluation. Provider errors are shown so the presenter can retry or switch to text.

## Files and saved records

Uploads can be up to 10 MB. Uploaded documents can contain up to 200,000 extracted characters; pasted text is limited to 60,000. PDFs need readable text. Uploaded code is read as text and is never executed.

SQLite stores assignments, answers and reports in `data/merit-lens.sqlite`. Local databases, provider keys, logs and test output are excluded from Git.

The report separates the assignment grade from interview understanding. Challenging reports also show explanation, application and consistency scores. The teacher can edit the suggested grade and decide what feedback to release.

Check saved record compares the source, answers and findings with their saved fingerprint. Download record gives a readable text file. This checks record integrity, not whether an AI judgment is correct.

## Tests

```bash
npm test
npm run build
npm run test:ui
```

Browser tests use installed Chrome, an in-memory database and port 5184. They use synthetic camera and audio fixtures. Live rehearsals are separate scripts and need configured provider keys.

## Demo notes

The home page links to the student flow and teacher workspace. Saved transfer examples are at `/#/transfer`. The older presentation view is at `/#/showcase`.

- [Presentation workflow](docs/DEMO_RUNBOOK.md)
- [Transfer challenge and bounded validation](docs/TRANSFER_CHALLENGE.md)
- [Assignment grading](docs/ASSIGNMENT_GRADING.md)
- [Local interviewer animation](docs/LOCAL_MOUTH.md)

Camera checks can pause an interview for teacher review. A possible phone holds it immediately. Sustained looking away or a missing face counts toward a two-warning limit. Leaving the tab allows seven seconds to return. Audio without visible mouth movement can also trigger a review warning. These signals can make mistakes and do not change the academic score.

The teacher and student roles are made for the hackathon demo. There is no real authentication yet, so I would not use real student data on a public deployment. The teacher remains responsible for the final decision. The tests and scripted validation examples do not guarantee error-free AI grading.
