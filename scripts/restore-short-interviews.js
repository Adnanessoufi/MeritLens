import {openDatabase,transaction} from '../server/db.js'
import {getConfig} from '../server/config.js'
import {demoAssignments} from '../server/demo-assignments.js'
const db=openDatabase(getConfig().database)
const counts=()=>Object.fromEntries(['submissions','sessions','answers','reports'].map(t=>[t,db.prepare('SELECT COUNT(*) n FROM '+t).get().n]))
const before=counts()
let correctedAssignments=0,correctedSessions=0
transaction(db,()=>{
 const project=demoAssignments.find(a=>a.id==='sample-project')
 db.prepare('UPDATE assignments SET brief=?,instructions_text=? WHERE id=?').run(project.brief,project.instructions,project.id)
 correctedAssignments=db.prepare("UPDATE assignments SET question_limit=6 WHERE challenge_mode='standard' AND question_limit<>6").run().changes
 correctedSessions=db.prepare("UPDATE sessions SET question_limit=6 WHERE challenge_mode='standard' AND question_limit<>6 AND status IN ('active','held')").run().changes
 if(JSON.stringify(before)!==JSON.stringify(counts()))throw Error('Saved record counts changed')
})
console.log(JSON.stringify({correctedAssignments,correctedSessions,historyPreserved:counts()}))
db.close()
