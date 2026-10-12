# Understanding Transfer Challenge — implementation and validation

## Acceptance criteria

The implementation requirements are the governing scope:

- Explicit transfer challenge mode.
- Two or three important concepts grounded in the submitted work.
- A committed explanation/justification followed by a small changed scenario, constraint, or bug on the same concept.
- Joint scoring of explanation, application, and reasoning consistency.
- Review flags when supported original reasoning does not transfer.

## Implemented protocol

`server/transfer.js` selects grounded concepts and uses structured AI output to generate one pair per concept. Source quotes and concept identifiers are constrained to the cached analysis. Private invariant/expected-reasoning/alternative-solution fields support assessment and are redacted from student session responses.

The bank is frozen before the student answers. It contains exactly four or six ordered questions: Explain 1, Apply 1, Explain 2, Apply 2, and optionally Explain 3, Apply 3. The standard adaptive stopping rule does not apply. Feedback/expected solutions are not shown between the two responses.

The first response is saved before the application is posed. The semantic evaluator sees both responses, the actual change, the source, and the private task rubric. Its quote fields are restricted to literal passages in each response. It accepts justified alternative solutions and appropriately changed decisions. Scores, rationales, exact quotes and pair identifiers persist in SQLite. Failed application evaluation leaves the first response and current question/timing intact for retry. Replayed answers cannot duplicate scores.

## Transparent scoring

Each dimension uses 0–2 points:

- **Explanation:** 0 no relevant correct original reasoning; 1 partial support; 2 sound justification of the original choice.
- **Transfer:** 0 does not correctly address the change; 1 plausible application with a required step unresolved; 2 sound specific application under the changed condition.
- **Consistency:** 0 the original principle breaks or the change is ignored; 1 partial linkage; 2 the principle is preserved through a justified application. It measures conceptual continuity, not matching wording. It cannot exceed the evidence supported by explanation/application. When no usable original principle is established, consistency is not rated.

Strong requires 2/2 on all three dimensions. Weak means application failed; other complete outcomes are Partial. A missing response yields Incomplete, with no numeric score or gap accusation.

A clear explanation–transfer gap requires explanation 2 and transfer 0. A possible gap requires explanation 1 and transfer 0. Explanation 0 never creates a reproduction-without-transfer flag. These are teacher-review signals, not proof of memorization, cheating or AI authorship. Percentages are task evidence points, not course grades.

## Demonstration

Open `/#/transfer`. Start a custom challenge or inspect strong, partial and weak fictional profiles. The three profiles use identical source material and fixed auditable reference pairs so their results are comparable. A separate live-generated plan is displayed to demonstrate the same generator used for new custom uploads.

The benchmark work concerns an ISBN catalog, average search complexity, and regression testing. Changes require independent physical-copy identity, searching by author rather than ISBN, and distinguishing a valid empty record from absence. Strong responses adapt the idea; partial responses identify the change but omit a step; weak responses repeat original reasoning while ignoring or contradicting the new constraint.

## Reproduce tests and measurement

```sh
npm test
npm run test:ui
node --env-file-if-exists=.env scripts/prepare-transfer.js
```

`--refresh` on the final command creates new fictional benchmark attempts and soft-archives prior examples. Existing sealed records are preserved. Expected labels and profile names are not sent to the pair grader. Results, rationales and literal quotes are written to `.test-artifacts/transfer-validation.json`; a fresh generated plan is written to `.test-artifacts/transfer-generated-plan.json`.

The test set contains nine profile/concept pairs and four controls: a valid alternative method, repeated incorrect reasoning, a missing application, and strong application with no supported baseline explanation. The feature page displays the measured classification agreement, detected gaps and false flags from this bounded set.

Integration tests verify 2/3-concept lengths and order, private rubric redaction, persistence, idempotency, retry after a failed scorer, absence of false consistency for repeated wrong answers, and incomplete-evidence handling. Browser rehearsal verifies the running feature and report presentation.

## Limits to demonstrate honestly

A small scripted set is not a population accuracy estimate. Different disciplines, ambiguous tasks or unusual valid solutions may require teacher review and clearer criteria. One scenario establishes only that application. Consistency scores depend on evidence in both answers. Clear/possible flags express support strength; they do not establish how the original answer was produced. Timings, accents, fluency, camera and page-focus signals are not scoring inputs.

## Assessment calibration note

Original reasoning is judged against the original question alone; students are not expected to anticipate the unrevealed changed scenario. Full application credit requires every essential output asked for (for example, diagnosing a bug, a regression case, and a valid fix). Recognizing a bug and proposing tests without the requested fix is partial evidence. Stating uncertainty does not itself reduce the score.

A live rerun during calibration classified 12 of 13 pairs as expected: it overrated a partial testing response as strong. The rubric was clarified and this run is retained in `.test-artifacts/transfer-validation-before-required-step-fix.json`. The feature page reports the latest actual run, rather than a hardcoded perfect score. This observed disagreement illustrates why the paired responses and task-specific scoring guide remain visible for teacher review.

Final verification includes 36 API tests, the 10 baseline browser workflows, and an opt-in live browser test that uploads new fictional work, generates two new pairs, completes all four turns, checks private scoring-guide redaction, and renders a mobile-compatible paired report. Speech is simulated in that browser test; question generation and assessment use the real configured provider.

The original explanation now has a separate assessment call containing only the source quote, original question, expected original reasoning and first response. It receives no changed scenario, application rubric, invariant or second response. Its result is fixed in the subsequent paired scorer's schema. A regression test verifies this separation. This prevents a later challenge from retroactively adding requirements to the student's first question.



## Laptop presentation and adaptive question guides

The feature page has separate tabs for the three examples, generated questions, and validation/limitations. Saved paired reports show one selected concept at a time. Report tabs separate evidence from transcripts/timing, source/context, and teacher review; unsaved review notes persist across these tabs.

New sessions default to adaptive guides determined by question type and length, rather than a blanket 90 seconds. Original explanation: 30–45 seconds; one changed situation: 45 seconds; bug or multi-step application: 60 seconds; focused follow-up: 20–30 seconds. A teacher may instead set a fixed guide. The student may extend only the current question by 15 seconds, up to 300 seconds. That extension and the original start timestamp survive refresh; the following question receives its own guide. Guides never auto-submit, interrupt, or influence the understanding score.

Verification after this change: 38 API tests passed, including per-stage transfer budgets, extension persistence, fixed-guide isolation, stale-question rejection, and receipt consistency. The ten baseline browser flows and two 1366×768 laptop checks passed. Existing saved attempts retain their original guides and evidence.
