import {writeFile} from 'node:fs/promises'
import {createAI} from '../server/ai.js'
import {getConfig} from '../server/config.js'
import {transferWork} from '../shared/transfer-fixtures.js'
const config={...getConfig(process.env),demo:false},ai=createAI(config)
const instructions='Write a design explanation for a Python reading-list application with ISBN lookup, duplicate ISBN validation, missing-book handling and empty-list tests. Explain dictionaries versus list search including average and worst-case complexity. No running program or executable code is required for this design explanation. Grade correctness 50 points, reasoning 30 points, testing and requirements 20 points.'
const prepared=await ai.prepareAssignment(instructions,'Computer science')
const assignment={...prepared,instructions_text:instructions,subject:'Computer science',reference_answer:'Dictionary lookup is O(1) on average, O(n) in the worst case. Duplicate ISBN inserts need explicit handling; .get can handle a missing key. Test empty list, duplicate keys, missing ISBN and malformed input.'}
const incorrect='I used a dictionary keyed by ISBN. A dictionary scans every book in order, so lookup is O(n) on average and never has collisions. Assigning the same ISBN again keeps both separate records automatically. I did not check missing keys because a dictionary always returns an empty string. I skipped all tests because the program ran once.'
const [strong,wrong]=await Promise.all([ai.assessSubmission(transferWork.text,assignment),ai.assessSubmission(incorrect,assignment)])
const receipt={createdAt:new Date().toISOString(),model:config.model,assignment,strong,incorrect:wrong,orderingMatches:strong.score!==null&&wrong.score!==null&&strong.score>wrong.score}
await writeFile('.test-artifacts/grading-live-validation.json',JSON.stringify(receipt,null,2))
console.log(JSON.stringify({preparedTitle:prepared.title,criteria:prepared.rubric.length,strongScore:strong.score,incorrectScore:wrong.score,total:strong.total,orderingMatches:receipt.orderingMatches,concerns:wrong.criteria.map(c=>c.concern).filter(Boolean)},null,2))
if(!receipt.orderingMatches)process.exitCode=1
