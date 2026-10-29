export type Tab = {
  id: string
  label: string
  platforms: string[]
  lang: string
} & ({ code: string } | { file: string })

export type Gotcha = {
  id: string
  platform: string
  issue: string
  fix: string
  evidence: string
}

export type MethodGuide = {
  tabs: Tab[]
  gotchas: Gotcha[]
  requiredGotchaIds: string[]
}
