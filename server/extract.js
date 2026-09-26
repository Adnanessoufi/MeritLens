import { extname } from 'node:path'
import mammoth from 'mammoth'
import { PDFParse } from 'pdf-parse'

export const MAX_TEXT = 60000
export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status }
}

export function requiredText(value, label, max = 1000, min = 1) {
  if (typeof value !== 'string' || value.trim().length < min) throw new HttpError(400, `${label} must contain at least ${min} characters.`)
  if (value.length > max) throw new HttpError(400, `${label} must be no more than ${max.toLocaleString()} characters.`)
  return value.trim()
}

export async function extractText(file, pasted) {
  if (!file) return { text: requiredText(pasted, 'Assignment text', MAX_TEXT, 40), filename: 'Pasted assignment' }
  const extension = extname(file.originalname).toLowerCase()
  let text
  try {
    if (extension === '.txt') {
      text = new TextDecoder('utf-8', { fatal: true }).decode(file.buffer)
    } else if (extension === '.docx') {
      text = (await mammoth.extractRawText({ buffer: file.buffer })).value
    } else if (extension === '.pdf') {
      const parser = new PDFParse({ data: new Uint8Array(file.buffer) })
      try { text = (await parser.getText()).text } finally { await parser.destroy() }
    } else throw new HttpError(415, 'Please choose a PDF, DOCX, or UTF-8 TXT file.')
  } catch (error) {
    if (error instanceof HttpError) throw error
    throw new HttpError(422, 'This file could not be read. Try a text-based PDF, DOCX, UTF-8 TXT file, or paste your text.')
  }
  text = text.replace(/\u0000/g, '').trim()
  if (text.length < 40) throw new HttpError(422, 'Not enough readable text was found. Scanned PDFs need OCR first; you can paste the assignment instead.')
  return { text: requiredText(text, 'Extracted assignment text', MAX_TEXT, 40), filename: file.originalname.slice(0, 200) }
}
