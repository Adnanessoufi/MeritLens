import {hungarianText} from '../shared/hu-copy.js'
import {reportModeLabel, formatEvidencePoints} from '../shared/report-results.js'
import {numericSuggestedGrade} from '../shared/grade-score.js'
import PDFDocument from 'pdfkit'
import {fileURLToPath} from 'node:url'
const font=fileURLToPath(new URL('../public/fonts/DM-Sans.ttf',import.meta.url))
const label={DEMONSTRATED:'Explained',PARTIAL:'Partial',UNCLEAR:'Unclear',PENDING:'Pending'}
export function renderReportPdf(report){
 const hu=report.displayLanguage==='hu',t=value=>hu?hungarianText(String(value??'')):String(value??'')
 return new Promise((resolve,reject)=>{
  const doc=new PDFDocument({size:'A4',margin:44,bufferPages:true,font,info:{Title:t('Assessment report')+' - '+report.student,Author:'Merit Lens'}})
  const chunks=[];doc.on('data',chunk=>chunks.push(chunk));doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.on('error',reject)
  const width=doc.page.width-88,green='#124a39',ink='#26312e',muted='#63736b'
  const room=n=>{if(doc.y+n>doc.page.height-58)doc.addPage()}
  const text=(value,size=10,color=ink)=>{doc.fontSize(size).fillColor(color).text(t(value),44,doc.y,{width,lineGap:3});doc.moveDown(.35)}
  const heading=value=>{room(65);doc.moveDown(.5);text(value,15,green)}
  text('meritlens.',14,green);text('Assessment report',24)
  text(report.student+' | '+report.assignmentTitle,12)
  text(reportModeLabel(report),10,green)
  text(new Intl.DateTimeFormat(hu?'hu-HU':'en-GB',{dateStyle:'medium',timeZone:'Europe/Budapest'}).format(new Date(report.created_at))+' | '+report.answers.length+' '+t('Responses')+(report.meeting?.endedForDeparture?' | '+t('Interview ended early'):report.defenceSkipped?' | '+t('Interview skipped'):''),9,muted)
  if(report.mode==='demo'||report.showcaseKind)text('Demonstration evidence',9,muted)
  if(report.offTopicSummary?.flagged)text(t('Repeated off-topic answers')+': '+report.offTopicSummary.count+' | '+t('Teacher review'),10,green)
  const grade=report.gradeReview||numericSuggestedGrade(report.gradingResult)
  heading('Assignment grade')
  if(grade?.criteria){
   text((grade.score??0)+' / '+grade.total,22,green)
   text(report.gradeReview?(report.gradeReview.releasedAt?'Published grade':'Teacher-approved grade'):'AI suggested grade - awaiting teacher approval',9,muted)
   for(const row of grade.criteria){room(35);const y=doc.y;doc.fontSize(10).fillColor(ink).text(t(row.name),44,y,{width:width-95});const bottom=doc.y;doc.text((row.score??0)+' / '+row.maxPoints,44+width-90,y,{width:90,align:'right'});doc.y=Math.max(bottom,doc.y)+6}
  }else text('Not graded yet.',10,muted)
  if(report.transferSummary){
   const transfer=report.transferSummary
   heading('Explain & apply results')
   text(t('Explain')+': '+t(formatEvidencePoints(transfer.explanation))+' | '+t('Apply')+': '+t(formatEvidencePoints(transfer.transfer))+' | '+t('Consistency')+': '+t(formatEvidencePoints(transfer.consistency))+' | '+t('Gaps')+': '+transfer.gapCount,10,green)
   for(const pair of transfer.pairs){
    heading(report.conceptLabels?.[pair.concept]||pair.concept)
    text(t('Explain')+' - '+(Number.isFinite(pair.explanationScore)?pair.explanationScore+' / 2':t('Not assessed')),11,green)
    text(pair.originalQuestion);text(t('Answer')+': '+(pair.originalResponse||t('No answer recorded.')));text(pair.explanationRationale,9,muted)
    if(pair.assessmentState==='skipped')text('Application skipped after the first answer.',10,muted)
    else {
     room(80);text(t('Apply')+' - '+(Number.isFinite(pair.transferScore)?pair.transferScore+' / 2':t('Not assessed')),11,green)
     text(pair.transferQuestion);text(t('Answer')+': '+(pair.applicationResponse||t('No answer recorded.')));text(pair.transferRationale,9,muted)
     if(pair.gapFlag)text('Gap: the idea was explained but not applied to the change.',10,green)
     if(Number.isFinite(pair.consistencyScore))text(t('Consistency')+': '+pair.consistencyScore+' / 2. '+pair.consistencyRationale,9,muted)
    }
   }
  }else{
   heading('Question results')
   if(!report.answers.length)text('No interview answers.',10,muted)
   for(const answer of report.answers){
    room(105);text(answer.position+'. '+t(label[answer.status]||answer.status)+' - '+(report.conceptLabels?.[answer.concept]||t(answer.concept))+(Number.isFinite(answer.rubric?.score)?' - '+answer.rubric.score+' / '+(answer.rubric.maxScore||2):''),11,green)
    text(answer.question,11);text(t('Answer')+': '+(answer.transcript||t('No answer recorded.')))
    text(answer.explanation,9,muted);doc.moveDown(.4)
   }
  }
  const feedback=report.gradeReview?.notes||report.feedback
  if(feedback){heading('Teacher feedback');text(feedback)}
  const pages=doc.bufferedPageRange()
  for(let page=0;page<pages.count;page++){
   doc.switchToPage(page);doc.page.margins.bottom=0;doc.fontSize(8).fillColor(muted).text('Merit Lens | '+(page+1)+' / '+pages.count,44,doc.page.height-36,{width,lineBreak:false,align:'right'})
  }
  doc.end()
 })
}
