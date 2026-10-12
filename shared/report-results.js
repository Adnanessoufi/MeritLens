import {PROJECT_DEMO_ID} from './project-demo.js'

export const reportModeLabel = report => report.challengeMode === 'transfer' || report.transferSummary ? 'Transfer challenge' : 'Standard oral defence'

// Historical demo monitoring topics are not part of the core learning overview.
// A camera topic in another subject (such as computer vision) remains valid evidence.
export function learningConceptVisible(assignmentId, concept) {
 return assignmentId !== PROJECT_DEMO_ID || !/^(?:camera(?: warnings?| checks?| and tab checks)?|tab warnings?|demo meeting|meeting rules)$/i.test(concept.trim())
}
export const formatEvidencePoints = value => value?.possible ? `${value.earned} / ${value.possible}` : 'Not assessed'
export function standardInterviewPoints(answers) {
 const rated = answers.filter(a => Number.isFinite(a.rubric?.score))
 return {earned:rated.reduce((n,a)=>n+a.rubric.score,0),possible:rated.reduce((n,a)=>n+(a.rubric.maxScore||2),0)}
}
