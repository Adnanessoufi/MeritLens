export const MEETING_MESSAGES_EN = {
 'speaker-mismatch':'I can hear audio, but I cannot see your mouth moving. Please face the camera and answer in your own voice. You can retry this question.',
 'speaker-held':'Audio and mouth movement did not match again. The interview has stopped for teacher review. Your answers are saved.',
 'identity-review':'The reference photo comparison needs a teacher check. This meeting is on hold while your identity is reviewed.',
 'phone-visible':'A possible phone is visible in the camera. The interview has stopped for teacher review. Your answers are saved.',
 'tab-warning':'Please do not leave the current tab. You have seven seconds to come back. If you leave again, this interview will stop for teacher review.',
 'face-missing':'Please keep your face visible in the camera. Adjust your camera and return before continuing.',
 'head-down':'Please look directly at the camera.',
 'head-turned':'Please return to your starting camera position. A repeated camera-position warning will pause the interview for teacher review.',
 'hands-out-of-frame':'Your hands are not clearly visible to the camera. Please bring them back into view before continuing.',
 held:'This interview is on hold for teacher review. Your saved answers are preserved.',
 timeout:'Time is up. I am saving your response and preparing the next question.'
}
const hu={
 'speaker-mismatch':'Hallok hangot, de nem látom, hogy mozogna a szád. Kérlek, nézz a kamerába, és a saját hangodon válaszolj. Újra próbálhatod ezt a kérdést.',
 'speaker-held':'A hang és a szájmozgás ismét nem egyezett. A beszélgetés tanári ellenőrzésre leállt. A válaszaid megmaradtak.',
 'identity-review':'A referenciafotó összehasonlítását a tanárnak kell ellenőriznie. A beszélgetés addig szünetel.',
 'phone-visible':'A kameraképen egy lehetséges telefon látható. A beszélgetés tanári ellenőrzésre leállt. A válaszaid megmaradtak.',
 'tab-warning':'Kérlek, ne hagyd el ezt a lapot. Hét másodperced van visszatérni. Ha ismét elhagyod, tanári ellenőrzésre leáll a beszélgetés.',
 'face-missing':'Kérlek, tartsd az arcodat a kamera látóterében. Állítsd be a kamerát, és térj vissza a folytatáshoz.',
 'head-down':'Kérlek, nézz közvetlenül a kamerába.',
 'head-turned':'Kérlek, térj vissza a kiindulási kamerapozíciódhoz. Ismételt figyelmeztetésnél tanári ellenőrzésre szünetel a beszélgetés.',
 'hands-out-of-frame':'A kezeid nem láthatók jól a kamerán. Kérlek, hozd őket a látótérbe a folytatás előtt.',
 held:'A beszélgetés tanári ellenőrzésre szünetel. Az elmentett válaszaid megmaradtak.',
 timeout:'Lejárt az idő. Mentem a válaszodat, és előkészítem a következő kérdést.'
}
export const meetingMessages=language=>language==='hu'?hu:MEETING_MESSAGES_EN
