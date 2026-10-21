# Vercel setup

The frontend and API run in the same Vercel project. Turso stores assignments, answers and reports, because Vercel does not keep local SQLite files between instances.

Server environment variables:

- `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`: created by the Turso Marketplace integration.
- `OPENAI_API_KEY` and `OPENAI_MODEL`: analysis, grading and transcription.
- `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, `ELEVENLABS_TTS_MODEL` and `ELEVENLABS_STT_MODEL`: interviewer voice.
- `VOICE_PROVIDER=elevenlabs` and `DEMO_MODE=auto`.
- `DEMO_ACCESS_PASSWORD`: shared demo password; the username is `demo`.
- `REQUIRE_DEMO_ACCESS_PASSWORD=true`: require the shared login for API access.

Keep secrets in Vercel, not Git or browser-prefixed variables. The existing local `.env` still works for local development. The local SQLite database is not uploaded.

Build with `npm run build`. Vercel serves `dist` and routes API requests to `api/index.js`. Functions and the database use Dublin. The API checks `/healthz` and uses request-driven interview cleanup rather than a background interval.

PDF files above 4 MB extract their readable text in the browser before upload. This preserves the document contents while staying within Vercel's request-body limit. The existing 10 MB file and 200,000-character document limits still apply; other file types above 4 MB need pasted text. Interview questions and scoring rules are unchanged.
