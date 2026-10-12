export function offTopicFeedback({count,aside='',language='en'}){
 const repeated=count>=2
 const lead=aside||({en:"Let's focus on the question, man.",hu:'Térjünk vissza a kérdéshez.',fr:'Revenons à la question.',ar:'لنعد إلى السؤال.'}[language]||"Let's focus on the question, man.")
 const warning={en:repeated?"Please stay on topic. I've flagged these unrelated answers for your teacher.":"Please take this seriously and answer the question. If it happens again, I'll flag it for your teacher.",hu:repeated?'Kérlek, maradj a témánál. Az ismételt, témától eltérő válaszokat jeleztem a tanárodnak.':'Kérlek, vedd komolyan, és válaszolj a kérdésre. Ha újra eltérsz a témától, jelzem a tanárodnak.',fr:repeated?"Merci de rester dans le sujet. J’ai signalé ces réponses sans rapport à votre enseignant.":"Merci de répondre sérieusement à la question. Si cela se répète, je le signalerai à votre enseignant.",ar:repeated?'يرجى الالتزام بالسؤال. سجّلت هذه الإجابات غير المتعلقة بالسؤال لمراجعة معلمك.':'يرجى الإجابة بجدية على السؤال. إذا تكرر ذلك، فسأسجله لمراجعة معلمك.'}
 const serious=warning[language]||warning.en
 return lead+' '+(language==='en'?'But '+serious.charAt(0).toLowerCase()+serious.slice(1):serious)
}
export function offTopicSummary(answers){
 const positions=answers.filter(a=>a.rubric?.offTopic===true).map(a=>a.position)
 return {count:positions.length,flagged:positions.length>=2,positions}
}
