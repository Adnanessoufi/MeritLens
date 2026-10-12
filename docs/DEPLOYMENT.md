# Put the working app online

Render runs the React build and Express API together. The repository includes `render.yaml` for a free web service in Frankfurt.

Open https://dashboard.render.com/blueprint/new?repo=https://github.com/Adnanessoufi/MeritLens and select this repository. Fill in the secret fields and apply the Blueprint. Render builds with `npm ci --include=dev && npm run build`, then runs `npm start`.

Use `demo` as the login name and choose a shared `DEMO_ACCESS_PASSWORD`. Share that password with people trying the app. The same login protects the teacher and student demo routes; this is not institutional authentication.

Add your OpenAI and ElevenLabs keys in Render's environment settings. The Blueprint keeps the current ElevenLabs voice ID and model. You can change `ELEVENLABS_VOICE_ID` and `ELEVENLABS_TTS_MODEL` in Render. These values stay out of Git. Restart or redeploy after changing them. Without an OpenAI key, analysis uses local practice rules.

The server uses Render's `PORT`, binds to `0.0.0.0` and trusts one reverse proxy so same-origin HTTPS uploads work. `/healthz` checks the database without exposing keys or student records. Camera and microphone permissions work through the hosted HTTPS URL.

Free Render instances sleep when idle. SQLite records disappear when the instance restarts, redeploys or sleeps. Download any reports you want to keep. For durable records, use a paid web service with a persistent disk mounted at `/var/data` and set `DATABASE_PATH=/var/data/merit-lens.sqlite`. Keep one instance because the database is local SQLite.

The hosted database starts with the three sample assignments. Existing local submissions and provider keys are not uploaded. The agreed English question sets are unchanged.
