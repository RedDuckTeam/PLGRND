// `node apps/web/scripts/fetch-upstream-idls.mjs`: downloads the third-party IDLs listed in
// src/__fixtures__/upstream-idls.json into the gitignored src/__fixtures__/.cache/, verifying each sha256.
// They are not committed because of their licences; tests that need them are skipped until this has run.
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const fixtures = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/__fixtures__')
const cache = path.join(fixtures, '.cache')
fs.mkdirSync(cache, { recursive: true })

for (const entry of JSON.parse(fs.readFileSync(path.join(fixtures, 'upstream-idls.json'), 'utf8'))) {
  const body = Buffer.from(await (await fetch(entry.url)).arrayBuffer())
  const sha256 = crypto.createHash('sha256').update(body).digest('hex')
  if (sha256 !== entry.sha256) throw new Error(`${entry.name}: sha256 ${sha256}, expected ${entry.sha256}`)
  fs.writeFileSync(path.join(cache, `${entry.name}.json`), body)
  console.log(`${entry.name}: ok (${body.length} bytes)`)
}
