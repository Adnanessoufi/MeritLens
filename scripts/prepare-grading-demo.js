import {readFile,writeFile} from 'node:fs/promises'
import {openDatabase,id,now,transaction} from '../server/db.js'
import {getConfig} from '../server/config.js'
import {sealReport} from '../server/evidence.js'
import {transferWork} from '../shared/transfer-fixtures.js'
const result=JSON.parse(await readFile('.test-artifacts/grading-live-validation.json','utf8'))
const db=openDatabase(getConfig(process.env).database),assignmentId='grading-demo-reading-list'
const incorrect='I used a dictionary keyed by ISBN. A dictionary scans every book in order, so lookup is O(n) on average and never has collisions. Assigning the same ISBN again keeps both separate records automatically. I did not check missing keys because a dictionary always returns an empty string. I skipped all tests because the program ran once.'
const assignment={...result.assignment,concepts:result.assignment.concepts||[]}
const examples=[['correct','Correct design · fictional example',transferWork.text,result.strong],['incorrect','Incorrect design · fictional example',incorrect,result.incorrect]]
transaction(db,()=>{
 if(!db.prepare('SELECT id FROM assignments WHERE id=?').get(assignmentId))db.prepare('INSERT INTO assignments(id,title,subject,brief,concepts,created_at,instructions_text,instructions_filename,rubric,reference_answer) VALUES(?,?,?,?,?,?,?,?,?,?)').run(assignmentId,'Reading-list design · grading demo','Computer science',assignment.brief,JSON.stringify(assignment.concepts),now(),assignment.instructions_text||assignment.brief,'Sample design assignment.txt',JSON.stringify(assignment.rubric),assignment.reference_answer||'')
 for(const [kind,student,text,grade] of examples){
  const submissionId='grading-demo-'+kind+'-work',sessionId='grading-demo-'+kind,reportId=sessionId+'-report'
  if(db.prepare('SELECT id FROM reports WHERE id=?').get(reportId))continue
  const analysis={summary:'Fictional submission-grading demonstration. No interview was conducted.',concepts:[],questions:[],sections:[],workAssessment:grade,assignmentSnapshot:assignment}
  db.prepare('INSERT INTO submissions(id,assignment_id,student,filename,text,analysis,mode,created_at,showcase_kind) VALUES(?,?,?,?,?,?,?,?,?)').run(submissionId,assignmentId,student,kind+'-design.txt',text,JSON.stringify(analysis),'live',now(),'grading-'+kind)
  db.prepare("INSERT INTO sessions(id,submission_id,status,bank,current,created_at,completed_at) VALUES(?,?,'completed','[]','{}',?,?)").run(sessionId,submissionId,now(),now())
  db.prepare('INSERT INTO reports(id,session_id,summary,strengths,review_areas,mode,created_at,grading_result) VALUES(?,?,?,?,?,?,?,?)').run(reportId,sessionId,'No oral interview was conducted for this fictional grading example. Understanding transfer has not been assessed.','[]','[]','live',now(),JSON.stringify(grade))
 }
})
for(const [kind] of examples)sealReport(db,'grading-demo-'+kind+'-report')
const links=examples.map(([kind,, ,grade])=>({kind,score:grade.score,total:grade.total,url:'http://127.0.0.1:5175/#/teacher/report/grading-demo-'+kind+'-report'}))
await writeFile('.test-artifacts/grading-demo-links.json',JSON.stringify(links,null,2));console.log(JSON.stringify(links,null,2));db.close()
