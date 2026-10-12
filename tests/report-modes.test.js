import {test} from 'node:test'
import assert from 'node:assert/strict'
import {setup} from './helpers.js'
import {installDemoAssignments} from '../server/demo-assignments.js'
import {preparedInterview} from '../server/prepared-interviews.js'
import {projectSampleText} from '../shared/project-demo.js'
import {learningConceptVisible,reportModeLabel,standardInterviewPoints} from '../shared/report-results.js'
import {renderReportPdf} from '../server/report-pdf.js'
import {PDFParse} from 'pdf-parse'

test('project sample restores the agreed camera question while coursework camera concepts remain valid',()=>{
 const prepared=preparedInterview(projectSampleText,{id:'sample-project'})
 assert.ok(prepared)
 assert.equal(prepared.analysis.questions.length,6)
 assert.ok(prepared.analysis.questions.some(q=>q.text==='Does a camera warning prove cheating?'))
 assert.ok(prepared.analysis.questions.some(q=>q.concept==='Camera warnings'))
 assert.equal(prepared.pairs[1].concept,'Camera warnings')
 assert.ok(projectSampleText.includes(prepared.pairs[1].sourceQuote))
 assert.equal(learningConceptVisible('sample-project','Camera warnings'),false)
 assert.equal(learningConceptVisible('vision-thesis','Camera warnings'),true)
 assert.equal(learningConceptVisible('sample-project','Testing understanding'),true)
})
test('insights filter old demo monitoring topics and keep standard/transfer findings separate',async t=>{
 const app=await setup(t);installDemoAssignments(app.db)
 let session=(await app.submit({assignmentId:'sample-project',text:projectSampleText})).data
 while(session.question)session=(await app.answer(session,"I don't know")).data
 app.db.prepare("UPDATE reports SET mode='live',concept_evidence=? WHERE id=?").run(JSON.stringify([{concept:'Camera warnings',status:'UNCLEAR'},{concept:'Problem',status:'PARTIAL'}]),session.reportId)
 const first=(await app.request('/insights')).data
 assert.ok(!first.concepts.some(c=>c.concept==='Camera warnings'))
 assert.equal(first.concepts.find(c=>c.concept==='Problem').challengeMode,'standard')
 const row=app.db.prepare('SELECT * FROM reports WHERE id=?').get(session.reportId)
 const second=(await app.submit({assignmentId:'sample-project',text:projectSampleText})).data
 // Fixture a completed second attempt in another mode without calling a provider.
 app.db.prepare("UPDATE sessions SET status='completed',challenge_mode='transfer' WHERE id=?").run(second.id)
 app.db.prepare('INSERT INTO reports(id,session_id,summary,strengths,review_areas,mode,created_at,concept_evidence) VALUES(?,?,?,?,?,?,?,?)').run('mode-fixture',second.id,'Fixture','[]','[]','live',row.created_at,JSON.stringify([{concept:'Problem',status:'DEMONSTRATED'}]))
 const findings=(await app.request('/insights')).data.concepts.filter(c=>c.concept==='Problem')
 assert.equal(findings.length,2)
 assert.equal(findings.find(c=>c.challengeMode==='standard').PARTIAL,1)
 assert.equal(findings.find(c=>c.challengeMode==='transfer').DEMONSTRATED,1)
 // Filtering presentation never changes saved answers or reports.
 assert.ok(JSON.parse(app.db.prepare('SELECT concept_evidence FROM reports WHERE id=?').get(session.reportId).concept_evidence).some(c=>c.concept==='Camera warnings'))
})
test('mode titles and numeric standard points are independent from assignment grades',()=>{
 assert.equal(reportModeLabel({challengeMode:'standard'}),'Standard oral defence')
 assert.equal(reportModeLabel({challengeMode:'transfer'}),'Transfer challenge')
 assert.deepEqual(standardInterviewPoints([{rubric:{score:2,maxScore:2}},{rubric:{score:0,maxScore:2}}]),{earned:2,possible:4})
})
test('PDF shows mode-specific evidence and labels deliberately unasked application questions',async()=>{
 const common={id:'fixture',student:'Test student',assignmentTitle:'Task',created_at:'2026-10-10T10:00:00Z',mode:'live',answers:[{position:1,question:'How?',concept:'Idea',transcript:'Answer',status:'DEMONSTRATED',explanation:'Correct.',rubric:{score:2,maxScore:2}}]}
 async function pdfText(report){const parser=new PDFParse({data:await renderReportPdf(report)});try{return(await parser.getText()).text}finally{await parser.destroy()}}
 const standard=await pdfText({...common,challengeMode:'standard'})
 assert.match(standard,/Standard oral defence/);assert.match(standard,/Question results/)
 const transfer=await pdfText({...common,challengeMode:'transfer',transferSummary:{explanation:{earned:0,possible:2},transfer:{earned:0,possible:0},consistency:{earned:0,possible:0},gapCount:0,pairs:[{concept:'Idea',assessmentState:'skipped',explanationScore:0,originalQuestion:'How?',originalResponse:"I don't know",explanationRationale:'No explanation.'}]}})
 assert.match(transfer,/Transfer challenge/);assert.match(transfer,/Explain & apply results/);assert.match(transfer,/Application skipped after the first answer/)
 assert.doesNotMatch(transfer,/Question results/)
})
