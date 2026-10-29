// Writes scripts/.v3shape-input.json for capture-v3-shape.capture.ts: the node data keys and handles of version-3
// flows, from the pre-rework code (node data types, node configs) and every published flow. Run it once from a
// checkout of the pre-rework commit, with cwd = apps/web/src:
//   node <repo>/apps/web/scripts/derive-v3-shape-input.cjs <PLGRND-SAMPLES>/flows <repo>/apps/web/scripts/.v3shape-input.json
const fs = require('fs')
const path = require('path')
const LZ = require(require.resolve('lz-string', { paths: [process.cwd()] }))

const [samplesDir, out] = process.argv.slice(2)
const walk = (d) =>
  fs
    .readdirSync(d, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]))
const types = [...fs.readFileSync('types/node.ts', 'utf8').matchAll(/^\s+(\w+) = '\w+',/gm)].map((m) => m[1])
const keys = {}
const add = (t, k) => (keys[t] ??= new Set()).add(k)

for (const f of walk('types/nodes')) {
  const s = fs.readFileSync(f, 'utf8')
  for (const m of s.matchAll(/export (?:type|interface) (\w+NodeData)\s*=?\s*\{([\s\S]*?)\n\}/g)) {
    const ks = [...m[2].matchAll(/^\s+(\w+)\??:/gm)].map((x) => x[1])
    for (const n of [...s.matchAll(/Node<\w+, NodeTypeEnum\.(\w+)>/g)].map((x) => x[1])) for (const k of ks) add(n, k)
  }
}

const reg = fs.readFileSync('utils/node/node-config-registry.ts', 'utf8')
const cfgFiles = Object.fromEntries(walk('utils/node/data').map((f) => [f, fs.readFileSync(f, 'utf8')]))
const handles = {}
for (const [, t, cfg] of reg.matchAll(/\[NodeTypeEnum\.(\w+)\]:\s*(\w+)/g)) {
  const file = Object.values(cfgFiles).find((s) => s.includes(`export const ${cfg} `))
  if (!file) throw new Error(`no config ${cfg}`)
  const block = file.slice(file.indexOf(`export const ${cfg} `))
  const fields = [...block.slice(0, block.indexOf('satisfies NodeConfig')).matchAll(/dataField: '([^']+)'/g)].map(
    (x) => x[1]
  )
  handles[t] = new Set(fields)
  for (const f of fields) add(t, f)
}

const flows = fs
  .readdirSync(samplesDir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(fs.readFileSync(path.join(samplesDir, f), 'utf8')))
  .filter((f) => Array.isArray(f.nodes))
for (const m of fs.readFileSync('constants/example-flows.ts', 'utf8').matchAll(/#flow=([^']+)/g)) {
  flows.push(JSON.parse(LZ.decompressFromEncodedURIComponent(m[1])))
}
for (const flow of flows) {
  for (const n of flow.nodes) for (const k of Object.keys(n.data ?? {})) add(n.type, k)
  for (const e of flow.edges) {
    for (const [h, id] of [
      [e.sourceHandle, e.source],
      [e.targetHandle, e.target],
    ]) {
      const t = flow.nodes.find((n) => n.id === id)?.type
      ;(handles[t] ??= new Set()).add(h.slice(id.length + 1).split('-')[0])
    }
  }
}

const shape = {
  types,
  dataKeys: Object.fromEntries(types.map((t) => [t, [...(keys[t] ?? [])].sort()])),
  handles: Object.fromEntries(types.map((t) => [t, [...(handles[t] ?? [])].sort()])),
  flows: flows.length,
}
fs.writeFileSync(out, JSON.stringify(shape, null, 1))
for (const t of types)
  console.log(t.padEnd(22), 'data:', shape.dataKeys[t].join(','), '| handles:', shape.handles[t].join(','))
console.log('flows', flows.length)
