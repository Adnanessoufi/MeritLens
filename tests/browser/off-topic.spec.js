import {test,expect} from '@playwright/test'
import {readFileSync} from 'node:fs'
const matlab=readFileSync(new URL('../../server/demo-materials/practicing-answers.m',import.meta.url),'utf8')

test('repeated unrelated answers appear immediately in teacher submissions and clearly in the report',async({page})=>{
 const created=await(await page.request.post('/api/assignments',{data:{title:'Matlab off-topic demo',brief:'Solve the eight MATLAB practice questions.'}})).json()
 let session=await(await page.request.post('/api/submissions',{data:{requestId:crypto.randomUUID(),assignmentId:created.id,student:'Off-topic UI fixture',text:matlab}})).json()
 for(const transcript of ['I love my dog.','The sky is blue.']){
  await page.request.post('/api/sessions/'+session.id+'/present',{data:{questionId:session.question.id}})
  session=await(await page.request.post('/api/sessions/'+session.id+'/answers',{data:{questionId:session.question.id,transcript,method:'text'}})).json()
 }
 expect(session.lastAnswerFeedback).toContain('flagged');expect(session.question.concept).toBe('Y-axis crossing')
 await page.goto('/#/teacher');await page.getByRole('button',{name:/Student submissions/}).click()
 await expect(page.getByText('Repeated off-topic answers',{exact:true})).toBeVisible()
 session=await(await page.request.post('/api/sessions/'+session.id+'/skip-defence',{data:{}})).json()
 await page.goto('/#/teacher/report/'+session.reportId)
 await expect(page.locator('.off-topic-notice')).toContainText('2 answers flagged for teacher review.')
 await expect(page.locator('.compact-answer .badge').getByText('Off topic',{exact:true})).toHaveCount(2)
 await page.screenshot({path:'.test-artifacts/screenshots/off-topic-report.png'})
})
