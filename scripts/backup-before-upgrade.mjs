import {DatabaseSync} from 'node:sqlite'
import {mkdirSync,writeFileSync} from 'node:fs'
import {resolve,sep} from 'node:path'
import {getConfig} from '../server/config.js'
const root=resolve('.'),database=resolve(getConfig().database)
if(!database.startsWith(root+sep))throw Error('Database is outside the app workspace')
mkdirSync('data/backups',{recursive:true})
const db=new DatabaseSync(database);db.exec('PRAGMA busy_timeout=5000')
const counts=()=>Object.fromEntries(['assignments','submissions','sessions','answers','reports'].map(t=>[t,db.prepare('SELECT COUNT(*) n FROM '+t).get().n]))
const before=counts(),file=resolve('data/backups/pre-hungarian-theme-'+new Date().toISOString().replace(/[:.]/g,'-')+'.sqlite')
db.prepare('VACUUM INTO ?').run(file)
const backup=new DatabaseSync(file,{readOnly:true})
if(backup.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw Error('Backup integrity failed')
const saved=Object.fromEntries(Object.keys(before).map(t=>[t,backup.prepare('SELECT COUNT(*) n FROM '+t).get().n]))
if(JSON.stringify(before)!==JSON.stringify(saved))throw Error('Backup record counts changed')
writeFileSync('.run/pre-upgrade-counts.json',JSON.stringify(before));backup.close();db.close()
console.log('Consistent backup verified; record counts',before)
