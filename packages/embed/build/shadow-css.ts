import postcss, { type AtRule, type Root, type Rule } from 'postcss'

/** The class of the widget's root element inside the shadow root (M6, M7). */
export const ROOT_CLASS = 'plgrnd-root'
const ROOT_SELECTOR = `.${ROOT_CLASS}`
/** Container name for widget breakpoints; widths are matched at a fixed 16px rem. */
export const CONTAINER_NAME = 'plgrnd'
const CONTAINER_REM_PX = 16

export interface ShadowCssCounts {
  /** `@property` registrations dropped (ignored inside shadow roots). */
  property: number
  /** Tailwind's `@supports (…-webkit-hyphens…)` fallback unwrapped so the initial values always apply. */
  propertyFallback: number
  /** `:root` selectors rewritten to the widget root. */
  root: number
  /** `:host` selectors rewritten to the widget root. */
  host: number
  /** `html` selectors rewritten to the widget root. */
  html: number
  /** `rem` lengths in declarations rewritten against the measured `--plgrnd-rem`. */
  rem: number
  /** Width `@media` queries moved to `@container plgrnd`. */
  container: number
  /** `body` rules dropped (M7 applies the app's body rule on the root). */
  body: number
}

/** Patterns that must match at least once, or the Tailwind/theme output has drifted from what M6 was written for. */
const REQUIRED: (keyof ShadowCssCounts)[] = ['property', 'propertyFallback', 'root', 'host', 'html', 'rem', 'container']

const PROPERTY_FALLBACK_RE = /-webkit-hyphens\s*:\s*none/
const REM_RE = /(-?(?:\d+\.?\d*|\.\d+))rem\b/g
const WIDTH_FEATURE_RE = /\(\s*(?:min-width|max-width|width)\s*[:<>=]|\(\s*[\d.]+(?:px|rem|em)\s*[<>]=?\s*width/
const NON_WIDTH_FEATURE_RE =
  /hover|pointer|prefers-|print|forced-colors|orientation|resolution|color-gamut|display-mode|scripting/

const remToCalc = (value: string, onMatch: () => void) =>
  value.replace(REM_RE, (_, n: string) => {
    onMatch()
    return `calc(${n} * var(--plgrnd-rem, 16px))`
  })

const remToPx = (params: string) => params.replace(REM_RE, (_, n: string) => `${Number(n) * CONTAINER_REM_PX}px`)

function rewriteSelector(selector: string, counts: ShadowCssCounts): string {
  const parts = selector.split(',').map((part) => {
    const trimmed = part.trim()
    if (trimmed === ':root') {
      counts.root++
      return ROOT_SELECTOR
    }
    if (trimmed === ':host') {
      counts.host++
      return ROOT_SELECTOR
    }
    if (trimmed === 'html') {
      counts.html++
      return ROOT_SELECTOR
    }
    return trimmed
  })
  return [...new Set(parts)].join(',')
}

/**
 * M6: makes Tailwind v4 + theme CSS behave inside a shadow root, deterministically and without touching
 * the host document: tokens and preflight are declared on `.plgrnd-root` (where `--plgrnd-rem` is set),
 * `rem` follows the measured root size, and widget breakpoints follow the widget's own width.
 */
export function transformShadowCss(css: string): { css: string; counts: ShadowCssCounts } {
  const counts: ShadowCssCounts = {
    property: 0,
    propertyFallback: 0,
    root: 0,
    host: 0,
    html: 0,
    rem: 0,
    container: 0,
    body: 0,
  }
  const root: Root = postcss.parse(css)

  root.walkAtRules((atRule: AtRule) => {
    if (atRule.name === 'property') {
      counts.property++
      atRule.remove()
      return
    }
    if (atRule.name === 'supports' && PROPERTY_FALLBACK_RE.test(atRule.params)) {
      counts.propertyFallback++
      atRule.replaceWith(atRule.nodes ?? [])
      return
    }
    if (atRule.name === 'media' && WIDTH_FEATURE_RE.test(atRule.params) && !NON_WIDTH_FEATURE_RE.test(atRule.params)) {
      counts.container++
      atRule.name = 'container'
      atRule.params = `${CONTAINER_NAME} ${remToPx(atRule.params.trim())}`
      atRule.raws.afterName = ' '
    }
  })

  root.walkRules((rule: Rule) => {
    if (rule.selector.trim() === 'body') {
      counts.body++
      rule.remove()
      return
    }
    rule.selector = rewriteSelector(rule.selector, counts)
  })

  root.walkDecls((decl) => {
    if (decl.value.includes('rem')) decl.value = remToCalc(decl.value, () => counts.rem++)
  })

  const missing = REQUIRED.filter((key) => counts[key] === 0)
  if (missing.length > 0) {
    throw new Error(`[shadow-css] patterns matched 0 times: ${missing.join(', ')} (counts ${JSON.stringify(counts)})`)
  }
  let leftover = ''
  root.walkRules((rule) => {
    if (/(^|,)\s*(:root|:host|html|body)\s*(,|$)/.test(rule.selector)) leftover = rule.selector
  })
  if (leftover) throw new Error(`[shadow-css] unscoped selector left: ${leftover}`)

  return { css: root.toString(), counts }
}
