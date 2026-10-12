import {writeFile,mkdir} from 'node:fs/promises'
import {openDatabase,transaction} from '../server/db.js'
import {getConfig} from '../server/config.js'
const db=openDatabase(getConfig(process.env).database)
const keep=['grading-demo-correct-work','grading-demo-incorrect-work']
for(const id of keep)if(!db.prepare('SELECT id FROM submissions WHERE id=?').get(id))throw Error('Required retained example is missing; cleanup stopped.')
const changed=db.prepare('SELECT id,archived FROM submissions WHERE archived=0 AND id NOT IN (?,?)').all(...keep)
const receipt={createdAt:new Date().toISOString(),retained:keep,archived:changed,restore:'Restore these IDs by setting submissions.archived to their saved value. No sessions, source text, answers or reports were deleted.'}
await mkdir('.test-artifacts',{recursive:true})
const path='.test-artifacts/submission-cleanup-'+receipt.createdAt.replace(/[:.]/g,'-')+'.json'
await writeFile(path,JSON.stringify(receipt,null,2))
transaction(db,()=>{const update=db.prepare('UPDATE submissions SET archived=1 WHERE id=? AND archived=0');for(const row of changed)update.run(row.id)})
console.log(JSON.stringify({visible:db.prepare('SELECT COUNT(*) n FROM submissions WHERE archived=0').get().n,archived:changed.length,receipt:path}));db.close()
