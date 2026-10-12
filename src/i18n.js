import {hungarianText} from './hu.js'
import { useEffect } from 'react'
import { QUESTION_DURATION_SECONDS } from '../shared/timer.js'

export const languages = { en: 'English', fr: 'Français', ar: 'العربية', hu: 'Magyar' }

const copy = {
  "Choose your workspace": ["Choisissez votre espace","اختر مساحتك"],
  "Student": ["Étudiant","طالب"],
  "Teacher": ["Enseignant","معلم"],
  "Enter": ["Entrer","دخول"],
  "Continue": ["Continuer","متابعة"],
  "Join your interview": ["Rejoignez votre entretien","انضم إلى مقابلتك"],
  "Assignment details": ["Détails du devoir","تفاصيل الواجب"],
  "Data & privacy": ["Données et confidentialité","البيانات والخصوصية"],
  "Meet Adnane": ["Rencontrez Adnane","تعرّف على عدنان"],
  "Your AI interviewer": ["Votre interlocuteur IA","محاورك بالذكاء الاصطناعي"],
  "ADNANE · AI INTERVIEWER": ["ADNANE · INTERLOCUTEUR IA","عدنان · محاور بالذكاء الاصطناعي"],
  "Camera required": ["Caméra requise","الكاميرا مطلوبة"],
  "Turn on your camera to continue": ["Activez votre caméra pour continuer","شغّل الكاميرا للمتابعة"],
  "Camera ready": ["Caméra prête","الكاميرا جاهزة"],
  "Camera exception selected": ["Exception de caméra sélectionnée","تم اختيار استثناء الكاميرا"],
  "Enable camera": ["Activer la caméra","تشغيل الكاميرا"],
  "Retry camera": ["Réessayer la caméra","إعادة محاولة الكاميرا"],
  "Camera unavailable?": ["Caméra indisponible ?","الكاميرا غير متاحة؟"],
  "Continue without camera": ["Continuer sans caméra","المتابعة بدون كاميرا"],
  "Continuing without camera": ["Continuer sans caméra","المتابعة بدون كاميرا"],
  "Keep your camera on during the interview. Your preview stays on this device; no images or video are recorded.": ["Gardez votre caméra activée pendant l’entretien. L’aperçu reste sur cet appareil ; aucune image ni vidéo n’est enregistrée.","أبقِ الكاميرا قيد التشغيل أثناء المقابلة. تبقى المعاينة على هذا الجهاز ولا يتم تسجيل صور أو فيديو."],
  "No camera, blocked access, or testing this demo? You can continue. Your teacher sees that the camera was unavailable; it does not change your understanding score.": ["Pas de caméra, accès bloqué ou test de cette démo ? Vous pouvez continuer. Votre enseignant voit l’indisponibilité de la caméra ; cela ne change pas votre évaluation.","لا توجد كاميرا أو الوصول محظور أو تجرّب العرض؟ يمكنك المتابعة. يرى المعلم أن الكاميرا لم تكن متاحة ولا يؤثر ذلك في تقييم فهمك."],
  "Reconnect your camera to continue": ["Reconnectez votre caméra pour continuer","أعد توصيل الكاميرا للمتابعة"],
  "Your answers and current question are still here.": ["Vos réponses et la question actuelle sont conservées.","إجاباتك والسؤال الحالي محفوظان."],
  "Camera on": ["Caméra activée","الكاميرا قيد التشغيل"],
  "Camera unavailable": ["Caméra indisponible","الكاميرا غير متاحة"],
  "Camera on · local preview": ["Caméra activée · aperçu local","الكاميرا قيد التشغيل · معاينة محلية"],
  "Camera exception · visible to your teacher": ["Exception de caméra · visible à votre enseignant","استثناء الكاميرا · ظاهر للمعلم"],
  "Local preview only. No video or images are stored.": ["Aperçu local uniquement. Aucune image ni vidéo n’est stockée.","معاينة محلية فقط. لا تُحفظ صور أو فيديو."],
  "Explain your reasoning in your own words.": ["Expliquez votre raisonnement avec vos propres mots.","اشرح تفكيرك بكلماتك الخاصة."],
  "Review the transcript before sending.": ["Relisez la transcription avant de l’envoyer.","راجع النص قبل الإرسال."],
  "Speaking": ["Parle","يتحدث"],
  "Listening": ["Écoute","يستمع"],
  "Ready": ["Prêt","جاهز"],
  "Your teacher reviews your reasoning.": ["Votre enseignant examine votre raisonnement.","يراجع المعلم تفكيرك."],
  "Camera and timing do not affect your understanding score.": ["La caméra et la durée n’influencent pas l’évaluation de votre compréhension.","الكاميرا والتوقيت لا يؤثران في تقييم فهمك."],
  "WELCOME TO MERIT LENS": ["BIENVENUE SUR MERIT LENS","مرحباً بك في MERIT LENS"],
  "Show the thinking behind the work.": ["Montrez le raisonnement derrière le travail.","أظهر التفكير وراء العمل."],
  "Students upload their work and answer a few short questions.": ["Les élèves envoient leur travail et répondent à quelques questions courtes.","يرفع الطلاب أعمالهم ويجيبون عن بضعة أسئلة قصيرة."],
  "Teachers review the answers and decide what needs a follow-up.": ["Les enseignants examinent les réponses et décident des points à approfondir.","يراجع المعلمون الإجابات ويحددون ما يحتاج إلى متابعة."],
  "Choose where to start": ["Choisissez par où commencer","اختر من أين تبدأ"],
  "Submit your assignment and answer questions about your work.": ["Envoyez votre devoir et répondez à des questions sur votre travail.","سلّم واجبك وأجب عن أسئلة حول عملك."],
  "Create an assignment, invite students, and review their answers.": ["Créez un devoir, invitez les élèves et examinez leurs réponses.","أنشئ واجباً وادعُ الطلاب وراجع إجاباتهم."],
  "Upload my work": ["Envoyer mon travail","ارفع عملي"],
  "Open teacher workspace": ["Ouvrir l’espace enseignant","افتح مساحة المعلم"],
  "Have a link from your teacher? Open that link directly.": ["Vous avez un lien de votre enseignant ? Ouvrez-le directement.","لديك رابط من معلمك؟ افتح ذلك الرابط مباشرة."],
  "Set up → share a link → review responses.": ["Configurer → partager un lien → examiner les réponses.","إعداد ← مشاركة رابط ← مراجعة الإجابات."],
  "Submit the work": ["Envoyer le travail","سلّم العمل"],
  "Upload a file or paste the text.": ["Envoyez un fichier ou collez le texte.","ارفع ملفاً أو الصق النص."],
  "Explain & apply": ["Expliquer et appliquer","اشرح وطبّق"],
  "Explain a choice, then try a small change.": ["Expliquez un choix, puis appliquez une petite modification.","اشرح اختياراً ثم جرّب تغييراً صغيراً."],
  "Review the answers": ["Examiner les réponses","راجع الإجابات"],
  "The teacher gives feedback.": ["L’enseignant donne son retour.","يقدّم المعلم ملاحظاته."],
  "Just exploring?": ["Vous voulez découvrir ?","تريد الاستكشاف فقط؟"],
  "See sample interviews and reports before starting.": ["Consultez des entretiens et rapports d’exemple avant de commencer.","اطّلع على مقابلات وتقارير نموذجية قبل البدء."],
  "View examples": ["Voir les exemples","عرض الأمثلة"],
  "Upload your work.": ["Envoyez votre travail.","ارفع عملك."],
  "Add your name, choose your assignment, then upload a file or paste your text.": ["Indiquez votre nom, choisissez le devoir, puis envoyez un fichier ou collez votre texte.","أدخل اسمك واختر واجبك ثم ارفع ملفاً أو الصق النص."],
  "1 · Your details and submitted work": ["1 · Vos informations et votre travail","١ · بياناتك وعملك"],
  "Upload your assignment": ["Envoyez votre devoir","ارفع واجبك"],
  "WHAT HAPPENS NEXT": ["LES ÉTAPES SUIVANTES","ما الخطوة التالية"],
  "Three simple steps.": ["Trois étapes simples.","ثلاث خطوات بسيطة."],
  "Upload your work": ["Envoyez votre travail","ارفع عملك"],
  "Use your teacher’s assignment. No file? Paste the text or try the sample.": ["Choisissez le devoir de votre enseignant. Sans fichier, collez le texte ou essayez l’exemple.","اختر واجب معلمك. لا يوجد ملف؟ الصق النص أو جرّب النموذج."],
  "Answer short questions": ["Répondez à des questions courtes","أجب عن أسئلة قصيرة"],
  "Explain your choices, one question at a time. Speak or type your answer.": ["Expliquez vos choix, une question à la fois. Parlez ou écrivez votre réponse.","اشرح اختياراتك سؤالاً تلو الآخر. تحدث أو اكتب إجابتك."],
  "Your teacher reviews": ["Votre enseignant examine les réponses","يراجع معلمك الإجابات"],
  "Your answers are saved in a report for feedback and any follow-up.": ["Vos réponses sont enregistrées dans un rapport pour le retour et le suivi.","تُحفظ إجاباتك في تقرير للملاحظات والمتابعة."],
  "You can add time. Timing does not affect your assessment.": ["Vous pouvez ajouter du temps. La durée n’influence pas l’évaluation.","يمكنك إضافة وقت. التوقيت لا يؤثر في تقييمك."],
  "Reading and typing are always available.": ["La lecture et la saisie restent toujours possibles.","القراءة والكتابة متاحتان دائماً."],
  'A NEW PERSPECTIVE ON ASSESSMENT': ['UNE NOUVELLE PERSPECTIVE SUR L’ÉVALUATION', 'منظور جديد للتقييم'],
  'Good work deserves': ['Un bon travail mérite', 'العمل الجيد يستحق'],
  'a': ['une', 'أن يكون هناك'],
  'conversation.': ['conversation.', 'حوار.'],
  'Go beyond the submission. A short, thoughtful oral defence helps students show the understanding behind their work.': ['Au-delà du devoir rendu, un court échange oral aide les élèves à montrer leur compréhension.', 'بعد تسليم الواجب، تساعد مناقشة شفهية قصيرة الطلاب على إظهار فهمهم لعملهم.'],
  'I’m a student': ['Je suis élève', 'أنا طالب'],
  'I’m a teacher': ['Je suis enseignant', 'أنا معلم'],
  'Not an AI detector. A window into understanding.': ['Pas un détecteur d’IA. Une fenêtre sur la compréhension.', 'ليس كاشفاً للذكاء الاصطناعي، بل نافذة على الفهم.'],
  'Bring your work': ['Apportez votre travail', 'أحضر عملك'],
  'Talk it through': ['Expliquez vos choix', 'اشرح فكرتك'],
  'Make understanding visible': ['Rendez la compréhension visible', 'أظهر فهمك'],
  'Upload your assignment. We find the ideas worth talking about.': ['Envoyez votre devoir. Nous repérons les idées à discuter.', 'ارفع واجبك. سنحدد الأفكار الجديرة بالمناقشة.'],
  'Answer a few personalized questions, one at a time.': ['Répondez à quelques questions personnalisées, une à la fois.', 'أجب عن بضعة أسئلة مخصصة، سؤالاً تلو الآخر.'],
  'Your teacher reviews the evidence, with your thinking in context.': ['Votre enseignant examine vos réponses dans leur contexte.', 'يراجع معلمك الأدلة ضمن سياق تفكيرك.'],
  'Back to home': ['Retour à l’accueil', 'العودة إلى الرئيسية'],
  'YOUR WORK IS THE STARTING POINT': ['VOTRE TRAVAIL EST LE POINT DE DÉPART', 'عملك هو نقطة البداية'],
  'Let’s hear your thinking.': ['Parlons de votre raisonnement.', 'لنسمع طريقة تفكيرك.'],
  'Bring your assignment. We’ll take it one question at a time.': ['Apportez votre devoir. Nous avancerons une question à la fois.', 'أحضر واجبك. سنتناول سؤالاً واحداً في كل مرة.'],
  'Your assignment': ['Votre devoir', 'واجبك'],
  'A little context for a meaningful conversation.': ['Un peu de contexte pour un échange utile.', 'بعض السياق لمحادثة مفيدة.'],
  'Your name': ['Votre nom', 'اسمك'],
  'Assignment': ['Devoir', 'الواجب'],
  'Upload a file': ['Téléverser un fichier', 'رفع ملف'],
  'Paste text': ['Coller du texte', 'لصق النص'],
  'Your ideas belong here': ['Vos idées ont leur place ici', 'أفكارك هنا'],
  'Drag your assignment here, or choose a file.': ['Glissez votre devoir ici ou choisissez un fichier.', 'اسحب واجبك هنا أو اختر ملفاً.'],
  'Choose file': ['Choisir un fichier', 'اختر ملفاً'],
  'Change file': ['Changer de fichier', 'تغيير الملف'],
  'PDF, DOCX, TXT · Up to 10 MB': ['PDF, DOCX, TXT · 10 Mo maximum', 'PDF، DOCX، TXT · حتى ١٠ ميغابايت'],
  'Assignment text': ['Texte du devoir', 'نص الواجب'],
  'e.g. Alex Morgan': ['Ex. Alex Morgan', 'مثلاً أليكس مورغان'],
  'Paste the full text of your assignment here…': ['Collez ici le texte complet de votre devoir…', 'الصق نص واجبك كاملاً هنا…'],
  'Explain your thinking in your own words…': ['Expliquez votre raisonnement avec vos propres mots…', 'اشرح تفكيرك بكلماتك…'],
  'Just taking a look?': ['Vous voulez essayer ?', 'تريد التجربة؟'],
  'Use a sample assignment': ['Utiliser un devoir d’exemple', 'استخدم واجباً نموذجياً'],
  'Upload & prepare my defence': ['Envoyer et préparer ma soutenance', 'ارفع واجبي وحضّر المناقشة'],
  'Reading your work & preparing questions…': ['Lecture de votre travail et préparation des questions…', 'نقرأ عملك ونحضّر الأسئلة…'],
  'A MOMENT TO MAKE IT YOURS': ['UN MOMENT POUR VOUS EXPRIMER', 'لحظتك للتعبير'],
  'Your work.': ['Votre travail.', 'عملك.'],
  'Your voice.': ['Votre voix.', 'صوتك.'],
  'Your understanding.': ['Votre compréhension.', 'فهمك.'],
  'No trick questions. Just an opportunity to explain the choices you made.': ['Pas de questions pièges. Une occasion d’expliquer vos choix.', 'لا أسئلة خادعة. إنها فرصة لشرح اختياراتك.'],
  '3–6 thoughtful questions': ['3 à 6 questions réfléchies', '٣ إلى ٦ أسئلة مدروسة'],
  'Based on your submitted work': ['Basées sur votre travail', 'بناءً على عملك المقدم'],
  [`${QUESTION_DURATION_SECONDS} seconds per question`]: [`${QUESTION_DURATION_SECONDS} secondes par question`, `${QUESTION_DURATION_SECONDS} ثانية لكل سؤال`],
  [`${QUESTION_DURATION_SECONDS} seconds each`]: [`${QUESTION_DURATION_SECONDS} secondes chacune`, `${QUESTION_DURATION_SECONDS} ثانية لكل سؤال`],
  'A guide, not a judgment': ['Un repère, pas un jugement', 'للتوجيه، وليس للحكم'],
  'Your teacher has the final word': ['Votre enseignant décide en dernier ressort', 'القرار النهائي لمعلمك'],
  'Every response stays in context': ['Chaque réponse garde son contexte', 'تُؤخذ كل إجابة في سياقها'],
  'Voice comes first.': ['La voix d’abord.', 'الصوت أولاً.'],
  'Reading and typing are always an option.': ['Lire et écrire restent possibles.', 'يمكنك دائماً القراءة والكتابة.'],
  'YOUR ASSIGNMENT IS READY': ['VOTRE DEVOIR EST PRÊT', 'واجبك جاهز'],
  'PICK UP WHERE YOU LEFT OFF': ['REPRENDRE LÀ OÙ VOUS EN ÉTIEZ', 'تابع من حيث توقفت'],
  'A conversation,': ['Une conversation,', 'محادثة،'],
  'at your pace.': ['à votre rythme.', 'على وتيرتك.'],
  '3–6 questions': ['3 à 6 questions', '٣ إلى ٦ أسئلة'],
  'Start oral defence': ['Commencer la soutenance', 'ابدأ المناقشة الشفهية'],
  'Resume oral defence': ['Reprendre la soutenance', 'استئناف المناقشة الشفهية'],
  'You can reveal any question or type an answer.': ['Vous pouvez afficher chaque question ou saisir votre réponse.', 'يمكنك إظهار أي سؤال أو كتابة إجابتك.'],
  'Hi': ['Bonjour', 'مرحباً'],
  '. Find a quiet spot and listen to each question. Then tap the microphone to explain your thinking.': ['. Installez-vous au calme et écoutez chaque question. Touchez ensuite le microphone pour expliquer votre raisonnement.', 'ابحث عن مكان هادئ واستمع إلى كل سؤال. ثم اضغط على الميكروفون لتشرح طريقة تفكيرك.'],
  'Practice mode · questions and evidence labels are illustrative.': ['Mode entraînement · questions et étiquettes indicatives.', 'وضع التدريب · الأسئلة وتصنيفات الأدلة توضيحية.'],
  'Question': ['Question', 'السؤال'],
  'of up to 6': ['sur 6 au maximum', 'من أصل ٦ كحد أقصى'],
  'Taking in your thinking…': ['Nous prenons en compte votre réponse…', 'نراجع إجابتك…'],
  'Putting your words on paper…': ['Nous transcrivons vos paroles…', 'نحوّل كلماتك إلى نص…'],
  'A question for you.': ['Une question pour vous.', 'لدي سؤال لك.'],
  'Your turn to share.': ['À vous de répondre.', 'دورك للمشاركة.'],
  'We’re listening.': ['Nous vous écoutons.', 'نستمع إليك.'],
  'Listen, then tell us what you think.': ['Écoutez, puis dites-nous ce que vous en pensez.', 'استمع ثم أخبرنا بما تفكر فيه.'],
  'Speak naturally. Tap the microphone when you’re done.': ['Parlez naturellement. Touchez le microphone quand vous avez terminé.', 'تحدث بطبيعتك. اضغط على الميكروفون عند الانتهاء.'],
  'Your response time has been saved.': ['Votre temps de réponse a été enregistré.', 'تم حفظ وقت إجابتك.'],
  'A few words in your own voice can say a lot.': ['Quelques mots de vous peuvent en dire beaucoup.', 'كلمات قليلة بصوتك قد تقول الكثير.'],
  'Listen Again': ['Réécouter', 'استمع مجدداً'],
  'See Question': ['Voir la question', 'أظهر السؤال'],
  'Question visible': ['Question affichée', 'السؤال ظاهر'],
  'Answer': ['Répondre', 'أجب'],
  'Record again': ['Réenregistrer', 'سجل مجدداً'],
  'Getting your microphone ready…': ['Préparation du microphone…', 'جارٍ تجهيز الميكروفون…'],
  'Finish recording': ['Terminer l’enregistrement', 'إنهاء التسجيل'],
  'Can’t speak? Type your answer': ['Impossible de parler ? Écrivez votre réponse', 'لا تستطيع التحدث؟ اكتب إجابتك'],
  'Use my voice instead': ['Utiliser ma voix', 'استخدم صوتي بدلاً من ذلك'],
  'Your answer': ['Votre réponse', 'إجابتك'],
  'Your transcript · review before sending': ['Votre transcription · vérifiez avant l’envoi', 'نص إجابتك · راجعه قبل الإرسال'],
  'Send answer': ['Envoyer la réponse', 'إرسال الإجابة'],
  'The timer has ended. You can still finish your answer.': ['Le temps est écoulé. Vous pouvez encore terminer votre réponse.', 'انتهى الوقت. لا يزال بإمكانك إكمال إجابتك.'],
  'Your teacher reviews the evidence. This is a conversation, not a verdict.': ['Votre enseignant examine les éléments. Cet échange n’est pas un verdict.', 'يراجع معلمك الأدلة. هذه محادثة وليست حكماً.'],
  'I’m not sure · skip this question': ['Je ne sais pas · passer cette question', 'لست متأكداً · تخطَّ هذا السؤال'],
  'Skip Defence': ['Passer toute la soutenance', 'تخطي المناقشة كاملة'],
  'Skip the entire oral defence? Your teacher will see that you skipped it.': ['Passer toute la soutenance ? Votre enseignant verra que vous l’avez passée.', 'هل تريد تخطي المناقشة الشفهية كاملة؟ سيرى معلمك أنك تخطيتها.'],
  'Cancel': ['Annuler', 'إلغاء'],
  'Yes, skip defence': ['Oui, passer la soutenance', 'نعم، تخطَّ المناقشة'],
  'Oral defence': ['Soutenance orale', 'المناقشة الشفهية'],
  'YOUR THINKING, HEARD': ['VOTRE RAISONNEMENT, ENTENDU', 'لقد سمعنا أفكارك'],
  'completed.': ['terminée.', 'اكتملت.'],
  'skipped.': ['passée.', 'تم تخطيها.'],
  'Your teacher will see that you skipped the oral defence.': ['Votre enseignant verra que vous avez passé la soutenance orale.', 'سيرى معلمك أنك تخطيت المناقشة الشفهية.'],
  'Your conversation is still open.': ['Votre conversation est encore ouverte.', 'محادثتك لا تزال مفتوحة.'],
  'Your answers are safely stored. The report could not be finished yet.': ['Vos réponses sont enregistrées. Le rapport n’a pas pu être terminé.', 'إجاباتك محفوظة. تعذر إكمال التقرير حالياً.'],
  'Demo mode uses local practice questions. Evidence labels are illustrative.': ['Le mode démo utilise des questions locales. Les étiquettes sont indicatives.', 'يستخدم الوضع التجريبي أسئلة تدريب محلية. التصنيفات توضيحية.'],
  'Your assignment and responses are sent to OpenAI for analysis.': ['Votre devoir et vos réponses sont envoyés à OpenAI pour analyse.', 'يُرسل واجبك وإجاباتك إلى OpenAI للتحليل.'],
  'Voice uses your browser’s speech services where supported.': ['La voix utilise les services vocaux de votre navigateur si disponibles.', 'يستخدم الصوت خدمات المتصفح الصوتية حيثما كانت متاحة.'],
  'Voice recordings are transcribed by ElevenLabs.': ['Les enregistrements vocaux sont transcrits par ElevenLabs.', 'تنسخ ElevenLabs التسجيلات الصوتية إلى نص.'],
  'Your responses have been submitted to your teacher for review.': ['Vos réponses ont été transmises à votre enseignant.', 'أُرسلت إجاباتك إلى معلمك لمراجعتها.'],
  'Submitted': ['Envoyé', 'تم الإرسال'],
  'Report pending': ['Rapport en attente', 'التقرير قيد الانتظار'],
  'Retry report generation': ['Réessayer de générer le rapport', 'أعد إنشاء التقرير'],
  'Open report in teacher demo': ['Ouvrir le rapport enseignant', 'افتح التقرير في عرض المعلم'],
  'There’s no automatic grade or verdict here.': ['Il n’y a ici ni note ni verdict automatiques.', 'لا توجد هنا درجة أو حكم آلي.'],
  'Your teacher will consider your responses in context.': ['Votre enseignant examinera vos réponses dans leur contexte.', 'سينظر معلمك في إجاباتك ضمن سياقها.'],
  'Choose a PDF, DOCX, or TXT file.': ['Choisissez un fichier PDF, DOCX ou TXT.', 'اختر ملف PDF أو DOCX أو TXT.'],
  'Choose a file smaller than 10 MB.': ['Choisissez un fichier de moins de 10 Mo.', 'اختر ملفاً أصغر من ١٠ ميغابايت.'],
  'Choose an assignment file first, or paste your text.': ['Choisissez d’abord un fichier ou collez votre texte.', 'اختر ملف الواجب أولاً أو الصق نصك.'],
}

const translatedNodes = new WeakMap()
const translatedAttributes=new WeakMap()

export function useStudentTranslation(language, route) {
  useEffect(() => {
    document.documentElement.lang = language
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr'
    const root = document.querySelector('.app')
    if (!root) return
    const index = language === 'fr' ? 0 : 1
    const localize=value=>language==='hu'?hungarianText(value):language==='en'?value:copy[value]?.[index]||value
    const translate = () => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
      let node
      while ((node = walker.nextNode())) {
        if (node.parentElement?.closest('script,style,textarea,pre,code,blockquote,[data-preserve-text],.language-select option,.assignment-list-title,.submission-name,.assignment-context p,.feedback-copy,.source-document')) continue
        const previous = translatedNodes.get(node)
        const original = previous && node.textContent === previous.translated ? previous.original : node.textContent
        const trimmed = original.trim()
        const replacement = language === 'en' ? null : localize(trimmed)
        const next = replacement ? original.replace(trimmed, replacement) : original
        if (node.textContent !== next) node.textContent = next
        translatedNodes.set(node, { original, translated: next })
      }
      root.querySelectorAll('[placeholder],[aria-label],[title]').forEach(element=>{
        const saved=translatedAttributes.get(element)||{}
        for(const attribute of ['placeholder','aria-label','title']){
          if(!element.hasAttribute(attribute))continue
          const current=element.getAttribute(attribute),previous=saved[attribute]
          const original=previous&&current===previous.translated?previous.original:current
          const value=localize(original)
          if(current!==value)element.setAttribute(attribute,value)
          saved[attribute]={original,translated:value}
        }
        translatedAttributes.set(element,saved)
      })
    }
    translate()
    const observer = new MutationObserver(translate)
    observer.observe(root, { childList: true, subtree: true, characterData: true })
    return () => observer.disconnect()
  }, [language, route])
}
