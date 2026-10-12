export const languages = { en: 'English', fr: 'French', ar: 'Arabic', hu: 'Hungarian' }

const sample = {
  'Why did you store your books in a dictionary instead of a list?': {
    hu: 'Miért szótárban tároltad a könyveket lista helyett?',
    fr: 'Pourquoi avez-vous stocké vos livres dans un dictionnaire plutôt que dans une liste ?',
    ar: 'لماذا خزّنت كتبك في قاموس بدلاً من قائمة؟',
  },
  'How does looking up a book by its ISBN work in your program?': {
    hu: 'Hogyan működik a könyv keresése ISBN alapján a programodban?',
    fr: 'Comment fonctionne la recherche d’un livre par ISBN dans votre programme ?',
    ar: 'كيف يعمل البحث عن كتاب برقم ISBN في برنامجك؟',
  },
  'How did you check that your program handles a book that is not in the reading list?': {
    hu: 'Hogyan ellenőrizted, hogy a program kezeli a listából hiányzó könyvet?',
    fr: 'Comment avez-vous vérifié que votre programme gère un livre absent de la liste de lecture ?',
    ar: 'كيف تحققت من أن برنامجك يتعامل مع كتاب غير موجود في قائمة القراءة؟',
  },
}

export function demoQuestion(question, language) {
  if (language === 'en') return question.text
  if (sample[question.text]?.[language]) return sample[question.text][language]
  const concept = question.concept
  if(language==='hu'){const quote=question.text.match(/[“"](.+)[”"]/s)?.[1];return quote?'A munkádban ezt írtad: „'+quote+'”. Elmagyaráznád a gondolatmenetedet?':'Elmagyaráznád, miért ezt a megoldást választottad a munkádban: „'+concept+'”?'}
  if (question.text.startsWith('In your work you wrote,')) {
    const quote = question.text.match(/[“"](.+)[”"]/s)?.[1] || concept
    return language === 'fr' ? `Dans votre travail, vous avez écrit « ${quote} ». Pouvez-vous expliquer votre raisonnement ?`
      : `كتبت في عملك: «${quote}». هل يمكنك شرح طريقة تفكيرك؟`
  }
  return language === 'fr' ? `Pouvez-vous expliquer votre choix concernant « ${concept} » dans votre travail ?`
    : `هل يمكنك شرح اختيارك المتعلق بـ «${concept}» في عملك؟`
}
