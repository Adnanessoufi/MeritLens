import {openDatabase,transaction} from '../server/db.js'
import {getConfig} from '../server/config.js'
import {demoAssignments} from '../server/demo-assignments.js'
const db=openDatabase(getConfig().database)
transaction(db,()=>{for(const a of demoAssignments){db.prepare('UPDATE assignments SET rubric=? WHERE id=? AND deleted_at IS NULL').run(JSON.stringify(a.rubric),a.id)}})
const pending=db.prepare(`SELECT r.id FROM reports r JOIN sessions s ON s.id=r.session_id JOIN submissions u ON u.id=s.submission_id JOIN assignments a ON a.id=u.assignment_id WHERE a.id IN ('sample-project','sample-thesis','sample-matlab') AND a.deleted_at IS NULL AND (r.grade_review IS NULL OR r.grade_review='null')`).all().filter(r=>!JSON.parse(db.prepare('SELECT grading_result FROM reports WHERE id=?').get(r.id).grading_result||'null')?.criteria)
console.log(JSON.stringify({rubrics:demoAssignments.map(a=>({id:a.id,total:a.rubric.reduce((n,r)=>n+r.maxPoints,0)})),pending:pending.map(r=>r.id)}))
db.close()
for(const row of pending){
 const response=await fetch('http://127.0.0.1:5175/api/reports/'+row.id+'/grade',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({language:'en'})})
 const result=await response.json();if(!response.ok)throw Error(row.id+': '+result.error)
 console.log(JSON.stringify({reportId:row.id,status:result.status,score:result.score,total:result.total}))
}
