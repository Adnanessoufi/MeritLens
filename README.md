# Merit Lens

I made Merit Lens to help teachers check if students understand the work they submit.

Students upload their work and answer a short interview about it. The teacher gets the answers, a suggested grade and a report they can download.

**Project website:** https://meritlens.netlify.app/

The website explains the idea. The working app is in this repository.

![Merit Lens](screenshots/landing-desktop.png)

## What it does

- Upload assignments and grading criteria, including points already written in a PDF
- Answer by voice or text, with ElevenLabs or OpenAI reading the questions
- Use standard mode for independent questions
- Use challenging mode to explain an idea and apply it to a new situation
- Review grades, answers and results, then download a PDF report
- Switch between English and Hungarian

There are three sample assignments: MATLAB, thesis and project description. They keep the question sets prepared for the demo. Other submissions use questions based on their content. The number-of-questions dropdown is only a visual demo option.

## Run it

You need Node.js 22.18 or newer.

```bash
npm ci
cp .env.example .env
npm run dev
```

On PowerShell, use `Copy-Item .env.example .env` to copy the file.

Add your own OpenAI and ElevenLabs keys to `.env`. Set your ElevenLabs voice ID there too. Restart the server after changing these settings. Without an OpenAI key, the app uses local practice rules.

Open http://127.0.0.1:5175.

For the built app, run `npm run build` followed by `npm start`.

## What is in the repo

| Folder | What it is for |
| --- | --- |
| `src` | Pages, styles and browser features |
| `server` | API, interviews, grading and saved records |
| `shared` | Rules and data used by both parts |
| `public` | Images, fonts and local camera models |
| `tests` | Backend and browser checks |
| `scripts` | Setup, backups and demo preparation |
| `docs` | Transfer validation and setup notes |
| `pitch` and `screenshots` | Project presentation |

The camera models are needed for the local checks. API keys, databases, old notes and test output stay outside Git.

## Tests

```bash
npm test
npm run build
npm run test:ui
```

Browser tests use installed Chrome and a separate in-memory app on port 5184.

The app uses React, Vite, Node.js, Express and SQLite. OpenAI handles analysis and transcription, ElevenLabs provides voice, and MediaPipe runs camera checks locally.

- [Transfer challenge and validation](docs/TRANSFER_CHALLENGE.md)
- [Pitch](pitch/Meritlens_GigaHack_2026_Pitch.pdf)

The teacher makes the final decision. Camera warnings are context, not proof of cheating.
