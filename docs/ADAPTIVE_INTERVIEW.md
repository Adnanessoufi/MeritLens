# Answer-responsive interview

The interview follows the public VivaProof approach: questions about submitted work, then proportionate follow-ups on what was actually said. References: https://www.vivaproof.com/answers/question-generation and https://www.vivaproof.com/answers/interview-style . This reproduces documented behaviour, not their private implementation.

- The welcome is one short sentence identifying Adnane as AI.
- Empty audio, unintelligible-audio responses and known transcription placeholders never receive a claim of understanding. Raw text is preserved, but absent evidence is not evaluated as an explanation.
- The microphone meter skips transcription only after several measured silent frames. If measurement is unavailable, normal transcription continues. A provider's explicit no-speech result also advances without inventing text. Technical errors retain retry/type options.
- Standard defence generates clarification/deeper questions from the current answer, and connects later concepts to the student's own cited source.
- Transfer keeps two/three concepts and ordered Explain/Apply pairs. Application wording responds to the explanation; the changed scenario, concept, invariant, required task and expected rubric stay fixed. The question must contain a literal phrase from the response. Its source and response anchors are saved in the bank and the answered question's rubric metadata, hidden from the student API.
- Questions are spoken first. Read question and typing reveal the text. The response clock begins after playback or explicit reveal.
- Preparing audio is distinct from Speaking. Reading/replay/stop cancels pending playback and preserves the original timer behaviour.

Validation: local API tests cover different response branches, silent placeholders, short numeric/symbolic answers, rejection of generic unanchored questions, missing-source rejection, preserved rubric/scenario and retry without duplicate records. Browser fixtures cover silence, unintelligible audio, explicit reading, adaptive deadlines, automatic voice, camera warnings and tab warnings. A real-provider rehearsal uses only two fictional inline replies and source; it shows different standard/transfer questions and preserves the scenario/rubric.

Run local tests with npm test and npx playwright test tests/browser/interview-silence.spec.js tests/browser/meeting.spec.js tests/browser/local-lips.spec.js . The opt-in script scripts/adaptive-live-rehearsal.js makes real OpenAI calls using the configured key; it reads no user documents and writes .test-artifacts/adaptive-live-rehearsal.json.

Limits: a short utterance or background noise can be difficult to distinguish from silence; no detector proves the absence of speech. Source anchoring checks literal provenance, not general question quality or grading accuracy. The two-case rehearsal is functional evidence, not an accuracy benchmark. AI scores remain teacher-review evidence. Transfer question wording can vary while the actual task stays fixed; the mode does not add unlimited follow-ups or reveal model answers.
