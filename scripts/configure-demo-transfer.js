import {openDatabase} from '../server/db.js'
import {getConfig} from '../server/config.js'
import {writeFile} from 'node:fs/promises'
const db=openDatabase(getConfig(process.env).database),ids=['sample-python','transfer-python','grading-demo-reading-list']
const previous=ids.map(id=>db.prepare('SELECT id,challenge_mode,concept_count FROM assignments WHERE id=?').get(id)).filter(Boolean)
await writeFile('.test-artifacts/teacher-policy-initialization.json',JSON.stringify({at:new Date().toISOString(),previous},null,2))
for(const row of previous)db.prepare("UPDATE assignments SET challenge_mode='transfer',concept_count=2 WHERE id=?").run(row.id)
console.log(JSON.stringify({configuredDemoAssignments:previous.length,mode:'transfer',concepts:2}));db.close()
