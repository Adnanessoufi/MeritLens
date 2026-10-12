export function isUnknownReply(text='') {
 const value=text.trim().toLowerCase().replace(/’/g,"'");
 return /^(?:(?:sorry|well|honestly|uh|um|okay|ok)[,! ]+)*(?:(?:i\s+)?(?:don't|do not|dont)\s+know|i(?:'m| am)\s+not\s+sure|(?:i\s+have\s+)?no\s+idea|not\s+sure|i\s+can't\s+(?:answer|remember))(?:[.!?, ]*(?:sorry|really|man|the answer(?: to (?:this|that)(?: question)?)?|what to say|about\s+(?:it|that|this)))?[.!? ]*$/.test(value)||/^(?:je ne sais pas|je sais pas|aucune idée|nem tudom|nem vagyok biztos benne|fogalmam sincs|لا أعرف|لا اعرف)[.!? ]*$/.test(value);
}
export function responseKind(text='') {
 const value=text.trim();
 if(!value||/^[.!?,…\s]+$/u.test(value)||/^(?:[\[(]\s*(?:blank[ _]?audio|silence|no[ _]?(?:audio|speech|answer)|inaudible|unintelligible|music)\s*[\])]|(?:thanks?|thank you)(?: for watching)?|köszönöm a figyelmet|köszönöm hogy megnézted|you|hello|hi|hey|ok(?:ay)?|hmm+|uh+|um+)[.!? ]*$/i.test(value))return 'none';
 return isUnknownReply(value)?'unknown':'answer';
}
export function shortAnswerQuote(text='') {
 const words=text.trim().split(/\s+/).slice(0,8);
 return words.join(' ').slice(0,110);
}
export function conversationLead({count=0,previous='',adaptive=false,stage,language='en',kind}={}) {
 const actual=kind||responseKind(previous);
 const key=count===0?'welcome':actual==='none'?'silent':actual==='unknown'?'unknown':stage==='apply'?'apply':adaptive?'followup':'thanks';
 const messages={
 en:{welcome:"Hi, I'm Adnane, your AI interviewer. Let's talk about your work.",silent:stage==='apply'?"I didn't catch an answer. Let's try a small change.":"I didn't catch an answer. Let's move on.",unknown:stage==='apply'?"No worries. Let's try it with a small change.":"No worries. Let's move to the next question.",apply:"Thanks. Now let's change one detail.",followup:"Let's look at that a little closer.",thanks:"Thanks for your response. Let's continue."},
 fr:{welcome:"Salut, je suis Adnane, ton interlocuteur IA. Parlons de ton travail.",silent:"Je n'ai pas entendu de réponse. On continue.",unknown:"Pas de souci. On essaie la suite.",apply:"Merci. Changeons un petit détail.",followup:"Regardons cette idée de plus près.",thanks:"Merci pour ta réponse. On continue."},
 hu:{welcome:"Szia, Adnane vagyok, az AI kérdeződ. Beszélgessünk a munkádról.",silent:"Nem hallottam választ. Lépjünk tovább.",unknown:"Semmi gond. Nézzük a következő kérdést.",apply:"Köszönöm. Most változtassunk egy részleten.",followup:"Nézzük ezt az ötletet egy kicsit alaposabban.",thanks:"Köszönöm a válaszodat. Folytassuk."},
 ar:{welcome:"مرحباً، أنا عدنان، محاورك بالذكاء الاصطناعي. لنتحدث عن عملك.",silent:"لم أسمع إجابة. لننتقل إلى السؤال التالي.",unknown:"لا بأس. لنجرب السؤال التالي.",apply:"شكراً. لنغير تفصيلاً صغيراً.",followup:"لنتعمق في هذه الفكرة قليلاً.",thanks:"شكراً على إجابتك. لنواصل."}
 };
 const variants={
 en:{silent:[messages.en.silent,"I didn't hear an answer. Let's try the next question.","No answer came through. Let's move to the next one."],unknown:[messages.en.unknown,"That's okay. You can try again on the next question.","No problem. Let's try something else.","Don't worry. Let's move to the next one."],thanks:[messages.en.thanks,"Thanks for explaining. Let's move on.","Thanks. Let's try the next question."]},
 fr:{unknown:[messages.fr.unknown,"C'est OK. Essayons une autre question."]},
 hu:{unknown:[messages.hu.unknown,"Ne aggódj. Próbáljuk a következőt."]},
 ar:{unknown:[messages.ar.unknown,"لا تقلق. لنجرب سؤالاً آخر."]}
 };
 const options=stage!=='apply'?variants[language]?.[key]:null;
 return options?options[Math.max(0,count-1)%options.length]:(messages[language]||messages.en)[key];
}

export function safeConversationReaction(value='') {
 if(typeof value!=='string')return ''
 const text=value.replace(/\s+/g,' ').trim()
 if(!text||text.length>180||text.split(/\s+/).length>18||/[?]/.test(text))return ''
 if(/\b(correct|perfect|exactly|brilliant|great answer|good point|clear|confident|well done|you're right|you are right|i understand|got it|the answer is|you should|you need to|actually)\b/i.test(text.replace(/’/g,"'")))return ''
 return text
}
