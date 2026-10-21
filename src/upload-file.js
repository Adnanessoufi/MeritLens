// Vercel limits function request bodies; extract larger PDFs before sending them.
export async function appendUpload(body, file, hosted = false) {
  if (!hosted || file.size <= 4 * 1024 * 1024) {
    body.append('file', file)
    return
  }
  if (!file.name.toLowerCase().endsWith('.pdf')) throw new Error('This hosted demo accepts non-PDF files up to 4 MB. Paste the text for larger files.')
  const pdfjs = await import('pdfjs-dist/build/pdf.mjs')
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href
  const document = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise
  const pages = []
  let length = 0
  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
      const page = await document.getPage(pageNumber)
      const content = await page.getTextContent()
      const text = content.items.map(item => item.str || '').join(' ')
      length += text.length
      if (length > 200000) throw new Error('Choose a PDF with fewer than 200,000 text characters.')
      pages.push(text)
    }
  } finally { await document.destroy() }
  const text = pages.join('\n\n').trim()
  if (!text) throw new Error('This PDF has no readable text. Paste its text instead.')
  body.append('file', new File([text], file.name + '.txt', { type: 'text/plain' }))
}
