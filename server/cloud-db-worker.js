import { parentPort, workerData } from 'node:worker_threads'
import { createClient } from '@libsql/client'

const client = createClient({ url: workerData.url, authToken: workerData.authToken })
let transaction = null
let queue = Promise.resolve()

async function execute({ operation, sql, args }) {
  if (operation === 'close') {
    await transaction?.rollback()
    client.close()
    return null
  }
  if (operation === 'exec') {
    const command = sql.trim().replace(/;$/, '').toUpperCase()
    if (command === 'BEGIN IMMEDIATE') {
      if (transaction) throw new Error('A database transaction is already open.')
      transaction = await client.transaction('write')
    } else if (command === 'COMMIT' || command === 'ROLLBACK') {
      if (!transaction) throw new Error('No database transaction is open.')
      const active = transaction
      transaction = null
      await (command === 'COMMIT' ? active.commit() : active.rollback())
    } else {
      // These settings apply to local files, not the hosted connection.
      const statements = sql.replace(/PRAGMA\s+(?:journal_mode|busy_timeout)\s*=\s*[^;]+;/gi, '')
      await (transaction || client).executeMultiple(statements)
    }
    return null
  }
  const result = await (transaction || client).execute({ sql, args })
  if (operation === 'run') return { changes: result.rowsAffected, lastInsertRowid: Number(result.lastInsertRowid || 0) }
  return result.rows.map(row => Object.fromEntries(result.columns.map(name => [name, row[name]])))
}

parentPort.on('message', message => {
  queue = queue.then(async () => {
    const state = new Int32Array(message.buffer, 0, 2)
    let result
    try { result = { value: await execute(message) } }
    catch (error) { result = { error: error.message } }
    let bytes = new TextEncoder().encode(JSON.stringify(result, (_, value) => typeof value === 'bigint' ? Number(value) : value))
    if (bytes.length > message.buffer.byteLength - 8) bytes = new TextEncoder().encode(JSON.stringify({ error: 'The database response is too large.' }))
    new Uint8Array(message.buffer, 8, bytes.length).set(bytes)
    Atomics.store(state, 1, bytes.length)
    Atomics.store(state, 0, 1)
    Atomics.notify(state, 0)
  })
})
