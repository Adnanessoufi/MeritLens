import {test,expect} from '@playwright/test'
import {readFileSync} from 'node:fs'
test('report opens directly with a grade, compact answers and a working PDF download',async({page})=>{
 const session=await(await page.request.post('/api/submissions',{data:{requestId:crypto.randomUUID(),assignmentId:'sample-project',student:'Compact report QA',text:'My project helps teachers ask questions about student work. Students upload their work and explain their decisions. Teachers review the answers and decide what feedback to share.'}})).json()
 await page.request.post('/api/sessions/'+session.id+'/present',{data:{questionId:session.question.id}})
 const answered=await(await page.request.post('/api/sessions/'+session.id+'/answers',{data:{questionId:session.question.id,transcript:'Teachers need to check the answers because an automated assessment can make mistakes.',method:'text'}})).json()
 const completed=await(await page.request.post('/api/sessions/'+answered.id+'/skip-defence',{data:{}})).json()
 await page.route('**/api/reports/'+completed.reportId,async route=>{const response=await route.fetch();return route.fulfill({json:{...await response.json(),gradingResult:{score:null,total:20,criteria:[{name:'Problem and users',score:4,maxPoints:4,rationale:'Clear problem.'},{name:'How it works',score:5,maxPoints:6,rationale:'Clear workflow.'},{name:'Design choices',score:3,maxPoints:4,rationale:'Some reasons.'},{name:'Testing and limits',score:null,maxPoints:6,rationale:'Limits noted.'}]}}})})
 await page.setViewportSize({width:1366,height:768});await page.goto('/#/teacher/report/'+completed.reportId)
 await expect(page.getByRole('heading',{name:'Assignment grade',exact:true})).toBeInViewport()
 await expect(page.locator('.compact-work-grade > .section-heading .grade-total')).toHaveText('12 / 20')
 await expect(page.getByRole('heading',{name:'Interview results',exact:true})).toBeInViewport()
 await expect(page.locator('.compact-grade-rows details').last().locator('summary')).toContainText('0 / 6')
 await expect(page.getByRole('navigation',{name:'Report sections'})).toHaveCount(0)
 await expect(page.getByText('Strengths to recognize',{exact:true})).toHaveCount(0)
 await expect(page.locator('.compact-answer-body')).not.toBeVisible()
 await page.screenshot({path:'.test-artifacts/screenshots/compact-report.png'})
 await page.locator('.compact-answer > summary').first().click();await expect(page.locator('.compact-answer-body')).toContainText('Teachers need to check')
 const download=page.waitForEvent('download');await page.getByRole('link',{name:'Download PDF',exact:true}).click();const file=await download
 expect(readFileSync(await file.path()).subarray(0,5).toString()).toBe('%PDF-')
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390)
})
