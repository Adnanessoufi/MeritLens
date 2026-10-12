// Suggested grades award only supported points. Unestablished criteria earn zero
// provisionally; the recorded concern remains available for teacher correction.
export function numericSuggestedGrade(result){
 if(!result?.criteria)return result
 const criteria=result.criteria.map(row=>{
  const established=Number.isFinite(row.score)
  const score=established?Math.min(row.maxPoints,Math.max(0,Math.round(row.score*100)/100)):0
  return {...row,score,...(!established?{scoreUnestablished:true}:{})}
 })
 return {...result,criteria,score:Math.round(criteria.reduce((n,row)=>n+row.score,0)*100)/100,total:Math.round(criteria.reduce((n,row)=>n+row.maxPoints,0)*100)/100}
}
