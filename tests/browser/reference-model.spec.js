import {test,expect} from '@playwright/test'
import {readFileSync,writeFileSync} from 'node:fs'
test('actual local one-to-one model matches the supplied portrait and rejects a non-reference face',async({page})=>{
 test.setTimeout(90000)
 await page.route('**/identity-test-engine.js',route=>route.fulfill({contentType:'text/javascript',body:readFileSync('src/reference-face.js','utf8')}))
 await page.route('**/identity-negative.jpg',route=>route.fulfill({contentType:'image/jpeg',body:readFileSync('.test-artifacts/vision-fixtures/coco-phone-119876.jpg')}))
 await page.goto('/')
 const result=await page.evaluate(async()=>{
  const {loadReferenceFaceEngine}=await import('/identity-test-engine.js')
  const engine=await loadReferenceFaceEngine()
  const self=new Image();self.src='/identity/reference.jpg';await self.decode()
  const other=new Image();other.src='/identity-negative.jpg';await other.decode()
  return {self:await engine.compare(self),other:await engine.compare(other)}
 })
 writeFileSync('.test-artifacts/reference-face-validation.json',JSON.stringify({scope:'Only supplied Adnane portraits compared against candidates; descriptors remain local.',...result},null,2))
 expect(result.self.status).toBe('candidate-match')
 expect(result.other.status).not.toBe('candidate-match')
})
