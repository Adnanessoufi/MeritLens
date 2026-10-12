import React, {useState} from 'react'
import {Badge, ListMore} from './components.jsx'
import {formatEvidencePoints, standardInterviewPoints} from '../shared/report-results.js'

const points = score => Number.isFinite(score) ? `${score} / 2` : 'Not assessed'
function AnswerEvidence({question,answer,reason,score,position,label}) {
 return <div className="paired-answer-evidence" id={position ? 'evidence-'+position : undefined}>
  <div className="paired-answer-heading"><strong>{label}</strong><span>{points(score)}</span></div>
  <p className="paired-answer-question">{question}</p><blockquote>{answer || 'No answer recorded.'}</blockquote>
  {reason && <p className="paired-answer-reason">{reason}</p>}
 </div>
}
export default function InterviewResults({report}) {
 const [limit,setLimit]=useState(2)
 const transfer=report.transferSummary
 if(transfer) return <section className="panel compact-interview-results compact-transfer-results">
  <div className="section-heading"><h2>Explain & apply results</h2></div>
  <div className="compact-transfer-metrics">
   <div><span>Explain</span><strong>{formatEvidencePoints(transfer.explanation)}</strong></div>
   <div><span>Apply</span><strong>{formatEvidencePoints(transfer.transfer)}</strong></div>
   <div><span>Consistency</span><strong>{formatEvidencePoints(transfer.consistency)}</strong></div>
   <div><span>Gaps</span><strong>{transfer.gapCount}</strong></div>
  </div>
  {transfer.pairs.slice(0,limit).map((pair,i)=><details className="compact-transfer-pair" key={pair.pairId}>
   <summary><span className="question-index">{i+1}</span><strong>{report.conceptLabels?.[pair.concept]||pair.concept}</strong><span className="pair-inline-points">Explain {points(pair.explanationScore)} · Apply {pair.assessmentState==='skipped'?'Skipped':points(pair.transferScore)}</span><Badge status={pair.gapFlag?'partial':pair.assessmentState==='skipped'||pair.assessmentState!=='complete'?'neutral':pair.status}>{pair.gapFlag?'Gap':pair.assessmentState==='skipped'?'Skipped':pair.assessmentState!=='complete'?'Incomplete':pair.status==='STRONG'?'Strong':pair.status==='PARTIAL'?'Partial':'Weak'}</Badge><span className="expand-mark">+</span></summary>
   <div className="compact-transfer-body">
    <AnswerEvidence label="Explain" question={pair.originalQuestion} answer={pair.originalResponse} reason={pair.explanationRationale} score={pair.explanationScore} position={pair.originalPosition}/>
    {pair.assessmentState==='skipped'?<p className="application-skipped">Application skipped after the first answer.</p>:<AnswerEvidence label="Apply" question={pair.transferQuestion} answer={pair.applicationResponse} reason={pair.transferRationale} score={pair.transferScore} position={pair.applicationPosition}/>}
    {pair.gapFlag && <p className="transfer-gap-note">The student explained the idea but could not apply it to the change.</p>}
    {pair.assessmentState==='complete'&&<details className="pair-consistency"><summary>Consistency · {points(pair.consistencyScore)}</summary><p>{pair.consistencyRationale}</p></details>}
   </div>
  </details>)}
  <ListMore total={transfer.pairs.length} limit={limit} step={2} onChange={setLimit} label="concepts"/>
 </section>
 const counts=Object.fromEntries(['DEMONSTRATED','PARTIAL','UNCLEAR'].map(status=>[status,report.answers.filter(a=>a.status===status).length]))
 return <section className="panel compact-interview-results">
  <div className="section-heading"><h2>Question results</h2><strong>{formatEvidencePoints(standardInterviewPoints(report.answers))}</strong></div>
  <div className="compact-result-counts"><span>{counts.DEMONSTRATED} explained</span><span>{counts.PARTIAL} partial</span><span>{counts.UNCLEAR} unclear</span></div>
  {report.answers.length?report.answers.slice(0,limit).map(answer=><details id={'evidence-'+answer.position} className="compact-answer" key={answer.id}><summary><span className="question-index">{answer.position}</span><strong>{answer.question}</strong><Badge status={answer.rubric?.offTopic?'partial':answer.status}>{answer.rubric?.offTopic?'Off topic':undefined}</Badge>{Number.isFinite(answer.rubric?.score)&&<small className="answer-score">{answer.rubric.score} / {answer.rubric.maxScore||2}</small>}<span className="expand-mark">+</span></summary><div className="compact-answer-body"><blockquote>{answer.transcript||'No answer recorded.'}</blockquote><p>{answer.explanation}</p><small>{report.conceptLabels?.[answer.concept]||answer.concept}</small></div></details>):<p className="muted">No interview answers.</p>}
  <ListMore total={report.answers.length} limit={limit} step={2} onChange={setLimit} label="questions"/>
 </section>
}
