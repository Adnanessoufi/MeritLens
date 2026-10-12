import {test,expect} from '@playwright/test'
import {sample} from '../helpers.js'
test('desktop completion keeps a single compact column with visible actions',async({page})=>{
 const session=await(await page.request.post('/api/submissions',{data:{requestId:crypto.randomUUID(),assignmentId:'sample-python',student:'Layout check',text:sample}})).json()
 await page.request.post('/api/sessions/'+session.id+'/leave',{data:{questionId:session.question.id}})
 for(const width of[1366,1920]){
  await page.setViewportSize({width,height:768})
  await page.goto('/#/complete/'+session.id)
  await expect(page.getByRole('heading',{name:'Interview ended',exact:true})).toBeVisible()
  await expect(page.getByRole('link',{name:'Back to home',exact:true})).toBeInViewport()
  const layout=await page.evaluate(()=>{
   const page=document.querySelector('.completion-page').getBoundingClientRect(),summary=document.querySelector('.completion-summary').getBoundingClientRect(),feedback=document.querySelector('.student-feedback').getBoundingClientRect()
   return{ratio:page.width/innerWidth,height:page.height,sideBySide:Math.abs(summary.top-feedback.top)<3,overflow:document.documentElement.scrollWidth>innerWidth}
  })
  expect(layout.ratio).toBeGreaterThan(.9)
  expect(layout.sideBySide).toBe(false)
  expect(layout.height).toBeLessThan(450)
  expect(layout.overflow).toBe(false)
  await page.screenshot({path:'.test-artifacts/screenshots/full-desktop-completion-'+width+'.png'})
 }
})
test('prefilled sample link reaches the real upload flow and desktop splits details from work',async({page})=>{
 await page.setViewportSize({width:1366,height:768})
 await page.goto('/#/student/sample-python/demo')
 await expect(page.getByRole('textbox',{name:'Your name',exact:true})).toHaveValue('Adnane Essoufi')
 await expect(page.getByRole('textbox',{name:'Assignment text',exact:true})).not.toHaveValue('')
 await expect(page.getByRole('button',{name:'Continue',exact:true})).toBeInViewport()
 const grid=await page.locator('.upload-desktop-grid').evaluate(n=>{const left=n.querySelector('.upload-details').getBoundingClientRect(),right=n.querySelector('.upload-work').getBoundingClientRect();return{width:n.getBoundingClientRect().width,sideBySide:Math.abs(left.top-right.top)<4&&right.left>=left.right}})
 expect(grid.width).toBeGreaterThan(1000)
 expect(grid.sideBySide).toBe(true)
 await page.screenshot({path:'.test-artifacts/screenshots/full-desktop-sample.png'})
})
