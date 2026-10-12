import {test,expect} from '@playwright/test'

const report={id:'ui-mode-fixture',student:'Test Student',assignmentTitle:'Project defence',created_at:'2026-10-10T10:00:00Z',mode:'live',challengeMode:'standard',submittedText:'A fictional project description.',review_status:'pending',feedback:'',conceptEvidence:[],expectedConcepts:[],availableFollowUpConcepts:[],answers:[1,2,3].map((n)=>({id:'answer-'+n,position:n,question:'Independent question '+n,concept:'Idea '+n,transcript:'My answer '+n,status:n===1?'DEMONSTRATED':'UNCLEAR',explanation:'Evidence for this answer.',rubric:{score:n===1?2:0,maxScore:2}}))}
async function openReport(page,data){
 await page.route(/\/api\/reports\/ui-mode-fixture(?:\?.*)?$/, route=>route.fulfill({json:data}))
 await page.goto('/#/teacher/report/ui-mode-fixture')
 await expect(page.getByRole('heading',{name:'Report',exact:true})).toBeVisible()
}
test('standard report shows independent question scores, only two initially, and no transfer metrics',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message))
 await openReport(page,report)
 await expect(page.getByText('Standard oral defence',{exact:true})).toBeVisible()
 await expect(page.getByRole('heading',{name:'Question results',exact:true})).toBeVisible()
 await expect(page.locator('.compact-answer')).toHaveCount(2)
 await expect(page.locator('.compact-transfer-metrics')).toHaveCount(0)
 await page.getByRole('button',{name:'Show more questions',exact:true}).click()
 await expect(page.locator('.compact-answer')).toHaveCount(3)
 await page.locator('.compact-answer').first().locator('summary').click()
 await expect(page.getByText('My answer 1',{exact:true})).toBeVisible()
 await page.screenshot({path:'.test-artifacts/screenshots/report-standard.png'})
 expect(errors).toEqual([])
})
test('challenge report puts paired evidence first and distinguishes a skipped application from a gap',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message))
 const pair={pairId:'pair-a',concept:'Problem',assessmentState:'complete',status:'WEAK',gapFlag:true,explanationScore:2,transferScore:0,consistencyScore:0,originalQuestion:'Why add an interview?',originalResponse:'To check understanding.',explanationRationale:'Explains the purpose.',transferQuestion:'What if the written work is good but the explanation is weak?',applicationResponse:'Always give full marks.',transferRationale:'Does not consider the missing understanding.',consistencyRationale:'The principle is not applied.',originalPosition:1,applicationPosition:2}
 await openReport(page,{...report,challengeMode:'transfer',transferSummary:{conceptCount:3,completedPairs:2,skippedPairs:1,gapCount:1,explanation:{earned:4,possible:6},transfer:{earned:2,possible:4},consistency:{earned:2,possible:4},pairs:[pair,{...pair,pairId:'pair-b',concept:'Questions',assessmentState:'skipped',gapFlag:false,explanationScore:0,transferScore:null,consistencyScore:null,transferQuestion:'SECRET UNASKED QUESTION'}, {...pair,pairId:'pair-c',concept:'Grade',status:'STRONG',gapFlag:false,transferScore:2,consistencyScore:2}]}})
 await expect(page.getByText('Transfer challenge',{exact:true})).toBeVisible()
 await expect(page.getByRole('heading',{name:'Explain & apply results',exact:true})).toBeVisible()
 await expect(page.locator('.compact-answer')).toHaveCount(0)
 await expect(page.locator('.compact-transfer-pair')).toHaveCount(2)
 await page.locator('.compact-transfer-pair').first().locator('summary').first().click()
 await expect(page.getByText('The student explained the idea but could not apply it to the change.',{exact:true})).toBeVisible()
 await page.locator('.compact-transfer-pair').nth(1).locator('summary').first().click()
 await expect(page.getByText('Application skipped after the first answer.',{exact:true})).toBeVisible()
 await expect(page.getByText('SECRET UNASKED QUESTION',{exact:true})).toHaveCount(0)
 await page.getByRole('button',{name:'Show more concepts',exact:true}).click()
 await expect(page.locator('.compact-transfer-pair')).toHaveCount(3)
 await page.screenshot({path:'.test-artifacts/screenshots/report-transfer.png'})
 await page.setViewportSize({width:390,height:844})
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false)
 expect(errors).toEqual([])
})


test('session details explain historical camera use, check record changes, and offer a readable download',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message))
 let session=await(await page.request.post('/api/submissions',{data:{requestId:crypto.randomUUID(),assignmentId:'sample-python',student:'Test Student',text:'Fictional project: a dictionary stores each book by its key for direct lookup.'}})).json()
 while(session.status==='active'){
  await page.request.post('/api/sessions/'+session.id+'/present',{data:{questionId:session.question.id}})
  session=await(await page.request.post('/api/sessions/'+session.id+'/answers',{data:{questionId:session.question.id,transcript:"I don't know",method:'text'}})).json()
 }
 const realReport=await(await page.request.get('/api/reports/'+session.reportId)).json()
 const receipt=realReport.evidenceReceipt
 const activity={tabAwayCount:0,hiddenSeconds:0,focusChanges:1,cameraEnabled:true,cameraObservations:{calibrated:true,headTurnedSeconds:3,faceMissingSeconds:0},events:[{id:'blur',type:'window-blur',created_at:'2026-10-10T10:00:00Z',details:{}}]}
 await page.route(new RegExp('/api/reports/'+session.reportId+'(?:\\?.*)?$'),route=>route.fulfill({json:{...realReport,activity}}))
 await page.goto('/#/teacher/report/'+session.reportId)
 await page.locator('.report-extra>summary').filter({hasText:'Session details'}).click()
 await expect(page.getByRole('heading',{name:'Interview activity',exact:true})).toBeVisible()
 await expect(page.getByText('Used',{exact:true})).toBeVisible()
 await expect(page.getByText('On',{exact:true})).toHaveCount(0)
 await page.getByRole('button',{name:'Check saved record',exact:true}).click()
 await expect(page.getByText('Checked now: saved record unchanged.',{exact:true})).toBeVisible()
 const pending=page.waitForEvent('download');await page.getByRole('link',{name:'Download record (.txt)',exact:true}).click()
 const download=await pending;expect(download.suggestedFilename()).toBe('merit-lens-record-'+session.reportId+'.txt')
 const {readFileSync}=await import('node:fs');expect(readFileSync(await download.path(),'utf8')).toContain('Question 1:')
 await expect(page.getByRole('link',{name:'Download JSON',exact:true})).toBeHidden()
 await page.screenshot({path:'.test-artifacts/screenshots/report-session-details.png',fullPage:true})
 await page.route('**/api/reports/'+session.reportId+'/receipt',route=>route.fulfill({json:{...receipt,matches:false}}))
 await page.getByRole('button',{name:'Check saved record',exact:true}).click()
 await expect(page.getByText('Checked now: changes found.',{exact:true})).toBeVisible()
 await page.setViewportSize({width:390,height:844})
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false)
 expect(errors).toEqual([])
})
