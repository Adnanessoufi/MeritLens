import {openDatabase,transaction} from '../server/db.js'
import {getConfig} from '../server/config.js'
import {numericSuggestedGrade} from '../shared/grade-score.js'
const db=openDatabase(getConfig().database)
let changed=0
transaction(db,()=>{
 for(const row of db.prepare('SELECT id,grading_result FROM reports').all()){
  const grade=JSON.parse(row.grading_result||'null');if(!grade?.criteria?.some(c=>!Number.isFinite(c.score)))continue
  db.prepare('UPDATE reports SET grading_result=? WHERE id=?').run(JSON.stringify(numericSuggestedGrade(grade)),row.id);changed++
 }
})
console.log(JSON.stringify({updatedSuggestedGrades:changed}));db.close()
