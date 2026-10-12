import {openDatabase,transaction} from '../server/db.js'
import {getConfig} from '../server/config.js'
import {demoAssignments} from '../server/demo-assignments.js'
import {projectSampleText} from '../shared/project-demo.js'
const db=openDatabase(getConfig().database)
transaction(db,()=>{for(const a of demoAssignments)db.prepare('UPDATE assignments SET rubric=? WHERE id=? AND deleted_at IS NULL').run(JSON.stringify(a.rubric),a.id)})
const rows=db.prepare(`SELECT r.id,r.grading_result,r.grade_review,u.text,u.assignment_id FROM reports r JOIN sessions s ON s.id=r.session_id JOIN submissions u ON u.id=s.submission_id WHERE u.assignment_id IN ('sample-project','sample-thesis','sample-matlab')`).all()
console.log(JSON.stringify({configured:demoAssignments.map(a=>({id:a.id,total:a.rubric.reduce((n,r)=>n+r.maxPoints,0)})),reports:rows.map(r=>({id:r.id,assignment:r.assignment_id,hasGrade:!!JSON.parse(r.grading_result||'null')?.criteria,hasTeacherGrade:!!JSON.parse(r.grade_review||'null'),exactPublicProjectSample:r.text===projectSampleText}))}))
db.close()
