export function meetingQuestionDuration(question = {}) {
 const text=(question.originalText||question.text||'').trim();
 const words=text.split(/\s+/u).filter(Boolean).length;
 const calculate=/\b(calculat\w*|comput\w*|derive|derivative|slope|solve|equation|roots?|normal vector)\b/i.test(text);
 const reasoning=/\b(why|explain|justify|reason\w*|compare|difference|trade.?off|how|test\w*)\b/i.test(text);
 const localizedCalculation=/számíts|számold|kiszám|derivál|derivált|old[dj] meg|egyenlet|normálvektor|calcul|dériv|équation|résou|احسب|معادلة|مشتقة/iu.test(text);
 const localizedReasoning=/miért|hogyan|magyaráz|indokol|hasonlí|különbség|teszt|ellenőriz|pourquoi|comment|expliqu|justifi|compar|différen|لماذا|كيف|اشرح|فسر|اختبر/iu.test(text);
 if(question.stage==='apply')return question.pairSpec?.changeType==='bug'||calculate||localizedCalculation||words>55?30:25;
 if(calculate||localizedCalculation)return 25;
 if(words>50)return 25;
 if(reasoning||localizedReasoning||question.stage==='explain')return words>24?25:20;
 return words>24?20:12;
}
