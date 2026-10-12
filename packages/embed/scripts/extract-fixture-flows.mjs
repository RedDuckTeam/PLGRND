// Writes fixtures/flows.json: the example flows used by the fixtures, extracted verbatim from
// apps/web/src/constants/example-flows.ts, plus two flows authored for the self-hosted QA:
//   P6: Text -> Encode (StringEncodingSelect pinned to base64) -> Display
//   P7: an IDL node with invalid JSON, which raises the mount-time "Invalid IDL JSON" toast
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import LZString from 'lz-string'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const examplesFile = path.resolve(root, '../../apps/web/src/constants/example-flows.ts')
const outFile = path.join(root, 'fixtures/flows.json')

const FLOW_VERSION = 3

const source = fs.readFileSync(examplesFile, 'utf8')
const examples = [...source.matchAll(/title:\s*'([^']+)'[\s\S]*?shareUrl:\s*'#flow=([^']+)'/g)].map((m) => ({
  title: m[1],
  payload: m[2],
}))
if (examples.length < 5) throw new Error(`expected at least 5 example flows, found ${examples.length}`)

const encode = (nodes, edges) =>
  LZString.compressToEncodedURIComponent(JSON.stringify({ v: FLOW_VERSION, nodes, edges }))

const edge = (source, sourceField, target, targetField) => ({
  id: `xy-edge__${source}-${sourceField}-${target}-${targetField}`,
  source,
  sourceHandle: `${source}-${sourceField}-right`,
  target,
  targetHandle: `${target}-${targetField}-left`,
})

const p6 = encode(
  [
    { id: 'p6-text', type: 'TEXT', position: { x: 0, y: 0 }, data: { text: 'Hello from PLGRND' } },
    { id: 'p6-encode', type: 'STRING_ENCODE', position: { x: 380, y: -10 }, data: { encoding: 'base64' } },
    { id: 'p6-display', type: 'DISPLAY', position: { x: 760, y: 0 }, data: {} },
  ],
  [edge('p6-text', 'text', 'p6-encode', 'input'), edge('p6-encode', 'text', 'p6-display', 'input')]
)

const p7 = encode(
  [
    { id: 'p7-text', type: 'TEXT', position: { x: 0, y: 0 }, data: { text: 'IDL below is invalid on purpose' } },
    { id: 'p7-idl', type: 'IDL', position: { x: 0, y: 120 }, data: { idlJson: '{ "invalid": ', programId: '' } },
  ],
  []
)

const flows = {
  P0: { title: examples[0].title, source: 'EXAMPLE_FLOWS[0]', payload: examples[0].payload },
  P2: { title: examples[2].title, source: 'EXAMPLE_FLOWS[2]', payload: examples[2].payload },
  P3: { title: examples[3].title, source: 'EXAMPLE_FLOWS[3]', payload: examples[3].payload },
  P4: { title: examples[4].title, source: 'EXAMPLE_FLOWS[4]', payload: examples[4].payload },
  P6: { title: 'String encode (base64)', source: 'authored', payload: p6 },
  P7: { title: 'Invalid IDL (mount-time toast)', source: 'authored', payload: p7 },
}

fs.writeFileSync(outFile, `${JSON.stringify(flows, null, 2)}\n`)
console.log(`wrote ${path.relative(process.cwd(), outFile)}: ${Object.keys(flows).join(', ')}`)
