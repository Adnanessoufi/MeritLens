# Understanding Transfer — one-minute demonstration

Live entry: http://127.0.0.1:5175/#/transfer. Saved demonstrations: http://127.0.0.1:5175/#/transfer/examples.

1. Keep **Weak → Dictionaries** selected. Show the original question and the saved explanation: 2/2.
2. Click **Reveal application**. The changed situation introduces two physical copies sharing an ISBN. The student repeats the original rule without separating the copies: application 0/2, consistency 0/2, gap flagged.
3. Select **Strong**, then reveal again. Same source and concept, a valid changed design: 2/2 application and consistency. Different wording or a different valid implementation can still preserve the principle.
4. Select **Partial**, then reveal. The student recognizes the change but leaves a required step unresolved. Inspect Why these scores & next step for the precise finding.
5. Open **Test results**. The saved bounded benchmark has 13/13 expected classifications, 3/3 expected gap flags, zero false gap flags. Show more exposes every case and the controls. This is a scripted demonstration, not a population accuracy estimate.

Say: “We record the first explanation, change one condition, and test whether the same idea can still be applied. The two answers are assessed together. A gap prompts teacher review.”

For a new live attempt, choose **Try with your work**. Transfer is now the default student flow, with two concepts and four questions; three concepts/six questions remain selectable. Teacher sharing links explicitly select transfer. Standard oral defence is retained under Other interview options or /standard links. In the meeting, concept/step labels distinguish Explain from Apply; the Apply step confirms that the first answer is saved. Private scoring guides are never sent in student question responses.

Fresh verification: scripts/transfer-focus-rehearsal.js used a new AI-generated two-concept plan, saved four ordered responses, intentionally repeated correct explanations under each change, and received E2/T0/C0 plus gap flags for both concepts. The report receipt matched. This functional rehearsal uses fictional responses and an in-memory database; it does not create inbox submissions or test physical microphone/camera permissions. Output: .test-artifacts/transfer-focus-live.json. Run with node --env-file-if-exists=.env scripts/transfer-focus-rehearsal.js; it consumes OpenAI API credits.

UI verification: tests/browser/transfer-clarity.spec.js checks reveal, same-concept strong/partial/weak switching, question preview, bounded validation rows and default transfer submission payload. tests/transfer.test.js checks the four/six-turn staging, hidden rubric, retry/idempotency, gap scoring, missing-response abstention and generation review. Production read-only Chrome check verifies real saved profile outcomes, 1366×768 fit and all three receipts. Screenshot: .test-artifacts/screenshots/transfer-live-clear.png.
