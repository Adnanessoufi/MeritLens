import {test,expect} from '@playwright/test'
import {sample} from '../helpers.js'
const rubric=[{name:'Correctness',description:'Correct dictionary claims.',maxPoints:60},{name:'Reasoning',description:'Justifies the choice.',maxPoints:40}]
test('teacher uploads a task, edits criteria, saves a private model answer; reviews grade and publishes explicitly',async({page})=>{
 await page.setViewportSize({width:1366,height:768});const errors=[];page.on('pageerror',e=>errors.push(e.message))
 await page.route('**/api/assignments/prepare',route=>route.fulfill({json:{title:'Uploaded reading-list task',brief:sample,text:sample,filename:'teacher-task.txt',concepts:['Dictionaries','Search complexity'],rubric}}))
 await page.goto('/#/teacher');await expect(page.locator('.provider-settings')).toHaveCount(0)
 await page.getByRole('button',{name:'Create assignment',exact:true}).first().click()
 await page.getByLabel('Upload assignment', {exact:true}).setInputFiles({name:'teacher-task.txt',mimeType:'text/plain',buffer:Buffer.from(sample)})
 await expect(page.getByRole('textbox',{name:'Assignment title',exact:true})).toHaveValue('Uploaded reading-list task')
 await expect(page.getByRole('combobox',{name:'Interview mode',exact:true})).toHaveValue('standard')
 await expect(page.getByRole('combobox',{name:'Concepts to test',exact:true})).toHaveCount(0)
 await page.getByRole('combobox',{name:'Interview mode',exact:true}).selectOption('transfer')
 await expect(page.getByRole('combobox',{name:'Concepts to test',exact:true})).toHaveValue('2')
 await page.getByRole('combobox',{name:'Interview mode',exact:true}).selectOption('standard')
 await expect(page.getByRole('button',{name:'Continue',exact:true})).toHaveCount(0)
 await page.getByText('Grading criteria · 100 points',{exact:true}).click()
 await expect(page.getByLabel('Criterion 1',{exact:true})).toHaveValue('Correctness')
 await page.getByLabel('Maximum points 1',{exact:true}).fill('50');await page.getByLabel('Maximum points 2',{exact:true}).fill('50')
 await page.screenshot({path:'.test-artifacts/screenshots/teacher-rubric-setup.png'})
 await page.getByText('Model answer · optional',{exact:true}).click()
 await page.getByLabel('Reference solution',{exact:true}).fill('PRIVATE_REFERENCE: average O(1), worst O(n).')
 await page.getByRole('dialog').getByRole('button',{name:'Create assignment',exact:true}).click()
 await expect(page.getByRole('heading',{name:'Uploaded reading-list task',exact:true})).toBeVisible()
 const assignmentId=page.url().split('/').pop()
 const teacher=await(await page.request.get('/api/teacher/assignments/'+assignmentId)).json();expect(teacher.rubric[0].maxPoints).toBe(50);expect(teacher.challenge_mode).toBe('standard')
 const publicList=await(await page.request.get('/api/assignments')).json();expect(JSON.stringify(publicList)).not.toContain('PRIVATE_REFERENCE')
 await page.screenshot({path:'.test-artifacts/screenshots/teacher-uploaded-assignment.png'})
 const session=await(await page.request.post('/api/submissions',{data:{requestId:crypto.randomUUID(),assignmentId,student:'Grade UI · fictional',text:sample}})).json()
 const completed=await(await page.request.post('/api/sessions/'+session.id+'/skip-defence',{data:{}})).json()
 const grade={status:'suggested',score:40,total:100,summary:'Dictionary claim is partly correct; review the missing worst-case explanation.',assessedAt:'2026-10-09T12:00:00Z',criteria:teacher.rubric.map(r=>({...r,score:20,rationale:'Incomplete explanation.',evidenceQuote:'Dictionaries allow average constant-time search complexity rather than scanning every book in a list.',concern:'Explain worst-case collisions.'}))}
 let reviewed=null,graded=false
 await page.route(new RegExp('/api/reports/'+completed.reportId+'(?:\\?.*)?$'),async route=>{const response=await route.fetch();await route.fulfill({json:{...await response.json(),gradingResult:graded?grade:null,gradeReview:reviewed}})})
 await page.route('**/api/reports/'+completed.reportId+'/grade',route=>{graded=true;return route.fulfill({json:grade})})
 await page.route('**/api/reports/'+completed.reportId+'/grade-review',route=>{const body=route.request().postDataJSON();expect(body.approved).toBe(true);reviewed={criteria:grade.criteria.map((r,i)=>({...r,score:body.scores[i]})),score:body.scores.reduce((a,b)=>a+b,0),total:100,notes:body.notes,approvedAt:new Date().toISOString(),releasedAt:body.release?new Date().toISOString():null};return route.fulfill({json:reviewed})})
 await page.goto('/#/teacher/report/'+completed.reportId)
 await page.getByRole('button',{name:'Calculate grade',exact:true}).click();await page.locator('.grade-edit > summary').click()
 await expect(page.getByText('AI suggestion · needs teacher approval',{exact:true})).toBeVisible()
 await expect(page.getByRole('button',{name:'Approve grade',exact:true})).toBeDisabled()
 await page.getByLabel('Awarded points 1',{exact:true}).fill('30')
 await page.getByLabel('Grading feedback',{exact:true}).fill('Reviewed the source: credit for average lookup; explain the worst case next.')
 await page.getByLabel('I reviewed the submitted work and these scores.').check()
 await page.screenshot({path:'.test-artifacts/screenshots/teacher-work-grade.png'})
 await page.getByLabel('Publish this grade and feedback to the student').check()
 await page.getByRole('button',{name:'Approve & publish grade',exact:true}).click()
 await expect(page.locator('.compact-work-grade > .section-heading').getByText('Published grade',{exact:true})).toBeVisible()
 await page.goto('/#/teacher/settings');await expect(page.locator('.provider-settings')).toBeVisible()
 await expect(page.getByText('Photo animation',{exact:true})).toBeVisible()
 await expect(page.getByText('Talking interviewer · D-ID',{exact:true})).toHaveCount(0)
 expect(errors).toEqual([])
})


test('teacher creates an assignment without grading criteria or a second step',async({page})=>{
 await page.setViewportSize({width:1366,height:768});
 await page.goto('/#/teacher');
 await page.getByRole('button',{name:'Create assignment',exact:true}).first().click();
 const dialog=page.getByRole('dialog');
 await dialog.getByLabel('Assignment title',{exact:true}).fill('Optional criteria test');
 await dialog.getByLabel('Instructions',{exact:true}).fill('Write a short program that calculates and plots a polynomial.');
 await expect(dialog.getByLabel('Upload grading criteria',{exact:true})).toBeVisible();
 await expect(dialog.getByRole('button',{name:'Continue',exact:true})).toHaveCount(0);
 await expect(dialog.getByRole('textbox',{name:'Criterion 1',exact:true})).toHaveCount(0);
 await expect(dialog.getByRole('button',{name:'Create assignment',exact:true})).toBeInViewport();
 await dialog.getByRole('button',{name:'Create assignment',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Optional criteria test',exact:true})).toBeVisible();
 const assignmentId=page.url().split('/').pop();
 const saved=await(await page.request.get('/api/teacher/assignments/'+assignmentId)).json();
 expect(saved.rubric).toEqual([]);
});

test('eight extracted task weights stay collapsed and fractional points can be edited without browser validation blocking save',async({page})=>{
 const weights=[2,1,6,1,2,3,3,2]
 await page.setViewportSize({width:1366,height:768})
 await page.route('**/api/assignments/prepare',route=>route.fulfill({json:{title:'Eight task upload',brief:'Complete eight short calculations.',text:'Fictional eight-task source.',filename:'eight-tasks.txt',concepts:['Calculations'],rubric:weights.map((maxPoints,i)=>({name:'Task '+(i+1),description:'Correct solution to task '+(i+1)+'.',maxPoints}))}}))
 await page.goto('/#/teacher');await page.getByRole('button',{name:'Create assignment',exact:true}).first().click()
 const dialog=page.getByRole('dialog')
 await dialog.getByLabel('Upload assignment',{exact:true}).setInputFiles({name:'eight-tasks.txt',mimeType:'text/plain',buffer:Buffer.from('Fictional eight-task source.')})
 await expect(dialog.getByText('Grading criteria · 20 points',{exact:true})).toBeVisible()
 await expect(dialog.getByLabel('Criterion 1',{exact:true})).not.toBeVisible()
 await expect(dialog.getByRole('button',{name:'Create assignment',exact:true})).toBeInViewport()
 await dialog.getByText('Grading criteria · 20 points',{exact:true}).click()
 await dialog.getByLabel('Criterion 1',{exact:true}).fill('')
 await dialog.getByText('Grading criteria · 20 points',{exact:true}).click()
 await dialog.getByRole('button',{name:'Create assignment',exact:true}).click()
 await expect(dialog.getByLabel('Criterion 1',{exact:true})).toBeVisible()
 await dialog.getByLabel('Criterion 1',{exact:true}).fill('Task 1')
 await dialog.getByLabel('Maximum points 1',{exact:true}).fill('0.25')
 await dialog.getByText('Grading criteria · 18.25 points',{exact:true}).click()
 await dialog.getByRole('button',{name:'Create assignment',exact:true}).click()
 await expect(page.getByRole('heading',{name:'Eight task upload',exact:true})).toBeVisible()
 const id=page.url().split('/').pop(),saved=await(await page.request.get('/api/teacher/assignments/'+id)).json()
 expect(saved.rubric).toHaveLength(8);expect(saved.rubric[0].maxPoints).toBe(.25)
 expect(saved.rubric.slice(1).map(c=>c.maxPoints)).toEqual(weights.slice(1))
})
