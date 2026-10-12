# Live demo — Merit Lens

Open http://127.0.0.1:5175/#/.

1. Choose **Teacher**. Create an assignment; upload the assignment PDF. Points included in the file become the grading criteria. A separate criteria file is optional. Add the private MATLAB model answer if you want a reference for grading.
2. Leave **Standard oral defence** selected, or choose **Understanding transfer** to test 2–3 concepts through paired explanation/application questions. The teacher controls this policy.
3. Share the student link. The student uploads their own work. The AI grounds the questions in that submission and uses earlier answers to shape later questions.
4. Complete the camera check and join. A camera-unavailable demo exception records that identity was not checked. The answer timer begins after the spoken question; its length depends on the task. **Read question**, **Type instead**, and **I don't know** are available.
5. Review the saved student report. **Work & grade** evaluates submitted-work correctness against the task/reference. Interview evidence shows what the student explained and applied. Review and approve before publishing a grade or feedback.

To check the avatar quickly, use http://127.0.0.1:5175/#/student/sample-project/demo. This prefills an editable description of Merit Lens; you still choose when to continue. It creates no submission until you continue.

Choose **Magyar** in the language menu for Hungarian. Uploaded code and original evidence quotes retain their original text.

The free avatar renderer animates a fixed mouth patch on Adnane's photo using the audio and his own photographed mouth detail. It is approximate 2D animation; it does not regenerate his whole face.

For the sprint demonstration of strong/partial/weak paired responses, open **Settings → Demo validation**. These are saved fictional examples, separate from the live student interview.

Camera observations and explanation/application gaps request teacher review. They do not establish cheating, memorization, AI use, or a final academic grade.

Start/restart with `scripts/start-demo.ps1`. Keys stay in the local `.env`; provider settings belong in the teacher Settings page. Existing records use SQLite and survive a restart.

The teacher dashboard now includes MATLAB practice (20 points), Thesis defence, and Project demo defence (a short oral defence with up to 6 source-specific adaptive questions). The project description replaces the Python reading-list sample.
