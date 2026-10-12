import {test,expect} from '@playwright/test'
import {readFile} from 'node:fs/promises'
import {PDFParse} from 'pdf-parse'

test('Magyar switches report prose and downloads, preserves original answers, and switches back to English',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message))
 const submitted=await(await page.request.post('/api/submissions',{data:{requestId:crypto.randomUUID(),assignmentId:'sample-thesis',student:'Magyar UI fixture',text:'Deepfake Image Detection Using Spatial Rich Models. RGB and SRM use EfficientNet. 20,000 final test images. Ensemble soft-voting. Dataset FFHQ.'}})).json()
 await page.request.post('/api/sessions/'+submitted.id+'/present',{data:{questionId:submitted.question.id}})
 const answered=await(await page.request.post('/api/sessions/'+submitted.id+'/answers',{data:{questionId:submitted.question.id,transcript:'ORIGINAL-STUDENT-ANSWER',method:'text'}})).json()
 const completed=await(await page.request.post('/api/sessions/'+answered.id+'/skip-defence',{data:{}})).json()
 const id=completed.reportId
 await page.route(new RegExp('/api/reports/'+id+'(?:\\?.*)?$'),async route=>{
  const response=await route.fetch(),data=await response.json()
  if(new URL(route.request().url()).searchParams.get('language')==='hu'){
   data.answers[0].question='Mi a kutatásod fő ötlete?';data.answers[0].explanation='A válasz nem magyarázza el a kutatás célját.'
  }
  await route.fulfill({json:data})
 })
 await page.goto('/#/teacher/report/'+id)
 await expect(page.getByRole('heading',{name:'Report',exact:true})).toBeVisible()
 await page.getByRole('combobox',{name:'Language',exact:true}).selectOption('hu')
 await expect(page.getByRole('heading',{name:'Jelentés',exact:true})).toBeVisible()
 await expect(page.getByText('Mi a kutatásod fő ötlete?',{exact:true})).toBeVisible()
 await page.locator('.compact-answer > summary').first().click()
 await expect(page.getByText('ORIGINAL-STUDENT-ANSWER',{exact:true})).toBeVisible()
 await expect(page.getByText('A válasz nem magyarázza el a kutatás célját.',{exact:true})).toBeVisible()
 await page.screenshot({path:'.test-artifacts/screenshots/hungarian-report.png'})
 const pending=page.waitForEvent('download');await page.getByRole('link',{name:'PDF letöltése',exact:true}).click()
 const download=await pending,parser=new PDFParse({data:new Uint8Array(await readFile(await download.path()))})
 let text;try{text=(await parser.getText()).text}finally{await parser.destroy()}
 expect(text).toContain('Értékelési jelentés');expect(text).not.toContain('Assignment grade')
 await page.getByRole('combobox',{name:'Nyelv',exact:true}).selectOption('en')
 await expect(page.getByRole('heading',{name:'Report',exact:true})).toBeVisible()
 await expect(page.getByText("What's the main idea of your research?",{exact:true})).toBeVisible()
 await page.getByRole('combobox',{name:'Language',exact:true}).selectOption('hu')
 await page.setViewportSize({width:390,height:844})
 await expect(page.getByRole('heading',{name:'Jelentés',exact:true})).toBeVisible()
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 await page.screenshot({path:'.test-artifacts/screenshots/hungarian-report-mobile.png'})
 expect(errors).toEqual([])
})
