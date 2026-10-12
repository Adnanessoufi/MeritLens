import {writeFileSync} from 'node:fs'
import {getConfig} from '../server/config.js'
import {synthesizeSpeech} from '../server/speech.js'
import {conversationLead} from '../shared/conversation.js'
import {demoQuestion} from '../server/languages.js'
const sourceQuote='My Python reading-list application stores books in dictionaries with ISBN keys.'
const question=demoQuestion({text:'In your work you wrote, "'+sourceQuote+'". Can you explain your reasoning?',concept:'Dictionaries'},'hu')
const text=conversationLead({language:'hu'})+' '+question
const audio=await synthesizeSpeech(getConfig(),text)
writeFileSync('tests/fixtures/hungarian-interviewer-qa.mp3',audio)
writeFileSync('tests/fixtures/hungarian-interviewer-qa.json',JSON.stringify({fictional:true,text,question,sourceQuote,bytes:audio.length,description:'AI-generated generic interviewer voice. No student recording or uploaded document. This cached fixture makes browser QA repeatable without keys or network.'},null,2))
console.log(JSON.stringify({bytes:audio.length,question},null,2))
