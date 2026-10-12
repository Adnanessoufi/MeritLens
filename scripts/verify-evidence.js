import { readFileSync } from 'node:fs'
import { verifyReceiptData } from '../server/evidence.js'
const path = process.argv[2]
if (!path) { console.error('Usage: node scripts/verify-evidence.js path/to/merit-lens-evidence.json'); process.exit(1) }
try {
  const receipt = JSON.parse(readFileSync(path, 'utf8'))
  const result = verifyReceiptData(receipt)
  console.log(result.matches ? 'The evidence package matches its receipt.' : 'The evidence package differs from its receipt or is incomplete.')
  console.log('Source: ' + (result.sourceMatches ? 'matches' : 'needs review') + ' · Record: ' + (result.recordMatches ? 'matches' : 'needs review'))
  process.exitCode = result.matches ? 0 : 1
} catch { console.error('This file could not be read as an evidence receipt.'); process.exitCode = 1 }
