import {hungarianText} from '../shared/hu-copy.js'
import {reportModeLabel,formatEvidencePoints} from '../shared/report-results.js'

const label = status => ({DEMONSTRATED:'Explained',PARTIAL:'Partial',UNCLEAR:'Unclear'}[status] || status || 'Not assessed')
export function renderEvidenceText(receipt,language='en',display=null) {
 const t=value=>language==='hu'?hungarianText(String(value)):value
 const record=receipt.evidence
 const concept=name=>display?.conceptLabels?.[name]||t(name)
 const lines=[t('MERIT LENS — SAVED INTERVIEW RECORD'),'',
  `${t('Student')}: ${record.student}`,`${t('Submission')}: ${record.filename}`,`${t('Report')}: ${receipt.reportId}`,
  `${t('Record created')}: ${receipt.createdAt}`,`${t('Check result')}: ${t(receipt.matches?'Saved record unchanged':'Saved record has changed — review needed')}`,
  `${t('Interview mode')}: ${t(reportModeLabel({transferSummary:record.transferChallenge}))}`,`${t('Responses')}: ${receipt.answerCount}`,
  '', t('WHAT THIS CHECK MEANS'),
  t('The saved submission, answers and AI findings are compared with the record created for this report.'),
  t('This does not verify identity, authorship or answer correctness. Assignment grades, teacher feedback and camera events are separate.'),
  '', t('SUBMITTED WORK'),record.sourceText,'',t('INTERVIEW ANSWERS')]
 if(display?.offTopicSummary?.flagged)lines.push(t('Repeated off-topic answers')+': '+display.offTopicSummary.count)
 for(const answer of record.answers){
  const shown=display?.answers.find(a=>a.position===answer.position)||answer
  lines.push('',`${t('Question')} ${answer.position}: ${shown.question}`,`${t('Concept')}: ${concept(answer.concept)}`,
   `${t('Answer')}: ${answer.transcript||t('No answer recorded.')}`,`${t('Result')}: ${t(label(answer.status))}`)
  if(Number.isFinite(answer.rubric?.score))lines.push(`${t('Points')}: ${answer.rubric.score} / ${answer.rubric.maxScore||2}`)
  if(answer.explanation)lines.push(`${t('Reason')}: ${shown.explanation}`)
 }
 if(record.transferChallenge){
  const transfer=record.transferChallenge
  lines.push('',t('CHALLENGE RESULTS'),`${t('Explain')}: ${t(formatEvidencePoints(transfer.explanation))}`,`${t('Apply')}: ${t(formatEvidencePoints(transfer.transfer))}`,`${t('Consistency')}: ${t(formatEvidencePoints(transfer.consistency))}`,`${t('Explanation/application gaps')}: ${transfer.gapCount}`)
  for(const pair of transfer.pairs){
   lines.push('',`${t('Concept')}: ${concept(pair.concept)}`,`${t('Explanation')}: ${Number.isFinite(pair.explanationScore)?pair.explanationScore+' / 2':t('Not assessed')}`,
    `${t('Application')}: ${pair.assessmentState==='skipped'?t('Skipped after the first answer'):Number.isFinite(pair.transferScore)?pair.transferScore+' / 2':t('Not assessed')}`)
   if(pair.gapFlag)lines.push(t('Gap: The explanation was correct, but the student could not apply the idea to the change.'))
  }
 }
 if(display?.summary||record.summary)lines.push('',t('AI FINDINGS'),display?.summary||record.summary)
 lines.push('',t('For the grade and teacher feedback, use Download PDF on the report.'),
  t('For technical verification, use Download JSON under Technical details.'),'')
 return lines.join('\n')
}
