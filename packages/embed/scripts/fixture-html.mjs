// Fixture HTML templating, shared by scripts/serve-fixtures.mjs (built files) and vite.config.ts (dev server):
//   %%FLOW:P3%%           -> the lz-string payload of fixtures/flows.json P3
//   <!--HOST-TW4-->       -> a Tailwind v4 host stylesheet when ?host=tw4
//   ?widgets=0            -> every <plgrnd-flow …></plgrnd-flow> is dropped (the scripts stay)
//   ?widgets=placeholder  -> every <plgrnd-flow> becomes an empty box of the same size (layout-preserving control)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const FIXTURES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../fixtures')

const PLACEHOLDER_BOX = 'display:block;position:relative;width:100%;aspect-ratio:16/9;min-height:320px'

const readFlows = () => JSON.parse(fs.readFileSync(path.join(FIXTURES, 'flows.json'), 'utf8'))

function placeholderFor(_, attrs) {
  const id = /\bid="([^"]*)"/.exec(attrs)?.[1]
  const style = /\bstyle="([^"]*)"/.exec(attrs)?.[1] ?? ''
  const hidden = /\shidden(\s|=|$)/.test(attrs) ? ' hidden' : ''
  return `<div data-plgrnd-placeholder${id ? ` id="${id}"` : ''}${hidden} style="${hidden ? 'display:none' : PLACEHOLDER_BOX};${style}"></div>`
}

/** @param {string} text @param {URL} url @param {{ nonce?: string | null }} [options] */
export function renderFixtureHtml(text, url, options = {}) {
  const flows = readFlows()
  let html = text.replace(/%%FLOW:([A-Z0-9]+)%%/g, (_, name) => {
    if (!flows[name]) throw new Error(`unknown fixture flow ${name}`)
    return flows[name].payload
  })
  const widgets = url.searchParams.get('widgets')
  if (widgets === '0') html = html.replace(/<plgrnd-flow\b[\s\S]*?<\/plgrnd-flow>/g, '')
  if (widgets === 'placeholder') html = html.replace(/<plgrnd-flow\b([^>]*)><\/plgrnd-flow>/g, placeholderFor)
  if (url.searchParams.get('host') === 'tw4') {
    html = html.replace('<!--HOST-TW4-->', '<link rel="stylesheet" href="/vendor/tailwind-v4-host.css" />')
  }
  if (options.nonce) html = html.replace(/<script\b/g, `<script nonce="${options.nonce}"`)
  return html
}
