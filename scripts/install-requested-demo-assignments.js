import {openDatabase,transaction} from '../server/db.js'
import {getConfig} from '../server/config.js'
import {installDemoAssignments} from '../server/demo-assignments.js'
const db=openDatabase(getConfig().database)
const before=Object.fromEntries(['submissions','sessions','answers','reports'].map(t=>[t,db.prepare('SELECT COUNT(*) n FROM '+t).get().n]))
transaction(db,()=>{
 installDemoAssignments(db)
 db.prepare('UPDATE assignments SET deleted_at=? WHERE id=? AND deleted_at IS NULL').run(new Date().toISOString(),'sample-python')
})
const after=Object.fromEntries(Object.keys(before).map(t=>[t,db.prepare('SELECT COUNT(*) n FROM '+t).get().n]))
if(JSON.stringify(before)!==JSON.stringify(after))throw Error('Historical record counts changed')
console.log(JSON.stringify({active:db.prepare('SELECT id,title,question_limit FROM assignments WHERE deleted_at IS NULL ORDER BY created_at DESC').all(),historyPreserved:after},null,2))
db.close()
