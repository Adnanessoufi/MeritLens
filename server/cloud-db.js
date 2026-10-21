import { Worker } from 'node:worker_threads'

// Keep the existing synchronous SQL interface; network work runs in a separate thread.
export function openCloudDatabase({ url, authToken, timeout = 30000 }) {
  const worker = new Worker(new URL('./cloud-db-worker.js', import.meta.url), { workerData: { url, authToken } })
  worker.unref()
  let closed = false
  function call(operation, sql = '', args = []) {
    if (closed) throw new Error('Database connection is closed.')
    const buffer = new SharedArrayBuffer(8 * 1024 * 1024)
    const state = new Int32Array(buffer, 0, 2)
    worker.postMessage({ operation, sql, args, buffer })
    if (Atomics.wait(state, 0, 0, timeout) === 'timed-out') {
      closed = true
      worker.terminate()
      throw new Error('The hosted database timed out. Reload before trying again.')
    }
    const result = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 8, state[1])))
    if (result.error) throw new Error(result.error)
    return result.value
  }
  return {
    exec: sql => call('exec', sql),
    prepare: sql => ({
      all: (...args) => call('all', sql, args),
      get: (...args) => call('all', sql, args)[0],
      run: (...args) => call('run', sql, args),
    }),
    close() {
      if (closed) return
      let stopped
      try { call('close') } finally { closed = true; stopped = worker.terminate() }
      return stopped
    },
  }
}
