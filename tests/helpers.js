import { randomUUID } from 'node:crypto'
import { openDatabase, seed } from '../server/db.js'
import { createApp } from '../server/app.js'
import { getConfig } from '../server/config.js'

export const sample = `My Python reading-list application stores books in dictionaries with ISBN keys. Dictionaries allow average constant-time search complexity rather than scanning every book in a list. I tested a missing book with dictionary.get, duplicate ISBNs, and an empty list. Testing showed that duplicates had overwritten an earlier entry. I added a validation check before inserting a book.`
export const detailedAnswer = 'I used a dictionary because the ISBN is a unique key. Looking up that key avoids scanning the entire reading list. It gives average constant time lookup, although it uses more memory and collisions can slow the worst case.'

export async function setup(t, overrides = {}, dependencies = {}) {
  const db = openDatabase(':memory:')
  seed(db)
  const config = { ...getConfig({ DEMO_MODE: 'true' }), ...overrides }
  const app = createApp(db, config, dependencies)
  const server = await new Promise(resolve => { const server = app.listen(0, '127.0.0.1', () => resolve(server)) })
  const base = `http://127.0.0.1:${server.address().port}`
  t.after(async () => { await new Promise(resolve => server.close(resolve)); db.close() })
  async function request(path, { body, ...options } = {}) {
    const response = await fetch(`${base}/api${path}`, { ...options, headers: { ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...options.headers },
      body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body) })
    const data = response.status === 204 ? null : await response.json()
    return { status: response.status, data }
  }
  const submit = (extra = {}) => request('/submissions', { method: 'POST', body: { requestId: randomUUID(), assignmentId: 'sample-python', student: 'Test Student', text: sample, ...extra } })
  async function answer(session, transcript = detailedAnswer, extra = {}) {
    await request(`/sessions/${session.id}/present`, { method: 'POST', body: { questionId: session.question.id } })
    return request(`/sessions/${session.id}/answers`, { method: 'POST', body: { questionId: session.question.id, transcript, method: 'text', ...extra } })
  }
  return { db, config, base, request, submit, answer }
}

// Tiny valid fixtures, generated in memory. No files or external document service needed.
export function pdfFixture(text = sample) {
  const content = `BT /F1 10 Tf 40 750 Td (${text.replace(/[()\\]/g, ' ')}) Tj ET`
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 1600 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${content.length} >>\nstream\n${content}\nendstream`]
  let value = '%PDF-1.4\n'
  const offsets = [0]
  objects.forEach((object, i) => { offsets.push(Buffer.byteLength(value)); value += `${i + 1} 0 obj\n${object}\nendobj\n` })
  const xref = Buffer.byteLength(value)
  value += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n => `${String(n).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return Buffer.from(value)
}

export function docxFixture(text = sample) {
  const files = {
    '[Content_Types].xml': '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    '_rels/.rels': '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    'word/document.xml': `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`,
  }
  const local = [], central = []
  let offset = 0
  for (const [name, content] of Object.entries(files)) {
    const filename = Buffer.from(name), data = Buffer.from(content)
    let crc = 0xffffffff
    for (const byte of data) { crc ^= byte; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)) }
    crc = (crc ^ 0xffffffff) >>> 0
    const head = Buffer.alloc(30)
    head.writeUInt32LE(0x04034b50); head.writeUInt16LE(20, 4); head.writeUInt32LE(crc, 14)
    head.writeUInt32LE(data.length, 18); head.writeUInt32LE(data.length, 22); head.writeUInt16LE(filename.length, 26)
    local.push(head, filename, data)
    const directory = Buffer.alloc(46)
    directory.writeUInt32LE(0x02014b50); directory.writeUInt16LE(20, 4); directory.writeUInt16LE(20, 6)
    directory.writeUInt32LE(crc, 16); directory.writeUInt32LE(data.length, 20); directory.writeUInt32LE(data.length, 24)
    directory.writeUInt16LE(filename.length, 28); directory.writeUInt32LE(offset, 42)
    central.push(directory, filename); offset += head.length + filename.length + data.length
  }
  const directory = Buffer.concat(central), end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(3, 8); end.writeUInt16LE(3, 10)
  end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16)
  return Buffer.concat([...local, directory, end])
}
