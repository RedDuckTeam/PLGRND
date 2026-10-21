import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { bundledLanguages, createHighlighter, isSpecialLang, type BundledLanguage } from 'shiki'
import { GUIDES, type MethodSlug } from '@/app/lib/guide'
import type { Tab } from '@/app/lib/guide/types'
import { CodeTabs } from './code-tabs'

const THEME = 'github-dark'

const highlighterPromise = createHighlighter({ themes: [THEME], langs: [] })

async function readTabCode(tab: Tab): Promise<string> {
  if ('code' in tab) return tab.code
  const filePath = path.join(process.cwd(), tab.file)
  try {
    return await readFile(filePath, 'utf8')
  } catch (error) {
    throw new Error(`SnippetTabs: cannot read file tab "${tab.id}" (${tab.file}) at ${filePath}`, { cause: error })
  }
}

async function highlight(code: string, lang: string): Promise<string> {
  const highlighter = await highlighterPromise
  if (!isSpecialLang(lang)) {
    if (!Object.hasOwn(bundledLanguages, lang)) throw new Error(`SnippetTabs: shiki has no language "${lang}"`)
    await highlighter.loadLanguage(lang as BundledLanguage)
  }
  return highlighter.codeToHtml(code.trimEnd(), { lang, theme: THEME })
}

export async function SnippetTabs({ method }: { method: MethodSlug }) {
  const guide = GUIDES[method]
  if (!guide) throw new Error(`SnippetTabs: unknown method "${method}"`)

  const tabs = await Promise.all(
    guide.tabs.map(async (tab) => {
      const code = await readTabCode(tab)
      return { id: tab.id, label: tab.label, platforms: tab.platforms, html: await highlight(code, tab.lang), code }
    })
  )

  return <CodeTabs idPrefix={`snippets-${method}`} tabs={tabs} />
}
