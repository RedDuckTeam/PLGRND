import type { MethodGuide } from './types.ts'

const ASTRO_ISLAND = `---
// src/pages/pdas.astro (npx astro add react)
import { PdaSeedsFlow } from '../components/pda-seeds-widget'
---

<PdaSeedsFlow client:visible />

<p>Example based on a <a href="https://plgrnd.io">PLGRND</a> flow.</p>`

const VUE_SFC = `<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import {
  generateKeyPair,
  getAddressEncoder,
  getAddressFromPublicKey,
  getProgramDerivedAddress,
  isAddress,
  type ReadonlyUint8Array,
} from '@solana/kit'

type Derived = { pda: string; bump: number } | { error: string }
type Example = { title: string; program: string; seed?: string; signer?: string; result?: Derived }

const PROGRAM_ID = 'BZLiJ62bzRryYp9mRobz47uA66WDgtfTXhhgM25tJyx5'
const MAX_SEED_BYTES = 32

const examples = reactive<Example[]>([
  { title: 'seeds = []', program: PROGRAM_ID },
  { title: 'seeds = [b"hello_world"]', program: PROGRAM_ID, seed: 'hello_world' },
  { title: 'seeds = [b"hello_world", signer.key().as_ref()]', program: PROGRAM_ID, seed: 'hello_world', signer: '' },
  {
    title: 'seeds = [b"hello_world"], seeds::program = other_program.key()',
    program: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
    seed: 'hello_world',
  },
])
const keygenFailed = ref(false)

async function derive({ program, seed, signer }: Example): Promise<Derived> {
  const programAddress = program.trim()
  if (!isAddress(programAddress)) return { error: 'The program id is not a valid base58 address.' }

  const seeds: ReadonlyUint8Array[] = []
  if (seed !== undefined) {
    const bytes = new TextEncoder().encode(seed)
    if (bytes.length > MAX_SEED_BYTES) return { error: 'A seed can be at most 32 bytes.' }
    seeds.push(bytes)
  }
  if (signer !== undefined) {
    const signerAddress = signer.trim()
    if (!isAddress(signerAddress)) return { error: 'The signer is not a valid base58 public key.' }
    seeds.push(getAddressEncoder().encode(signerAddress))
  }

  try {
    const [pda, bump] = await getProgramDerivedAddress({ programAddress, seeds })
    return { pda, bump }
  } catch {
    return { error: 'No PDA could be derived. WebCrypto (crypto.subtle) needs HTTPS or localhost.' }
  }
}

async function generate(example: Example) {
  try {
    const { publicKey } = await generateKeyPair()
    example.signer = await getAddressFromPublicKey(publicKey)
  } catch {
    keygenFailed.value = true
  }
}

for (const example of examples) {
  watch(
    () => [example.program, example.seed, example.signer],
    async (_inputs, _previous, onCleanup) => {
      let stale = false
      onCleanup(() => {
        stale = true
      })
      const result = await derive(example)
      if (!stale) example.result = result
    },
    { immediate: true }
  )
}

onMounted(() => {
  for (const example of examples) if (example.signer !== undefined) void generate(example)
})
</script>

<template>
  <section v-for="example in examples" :key="example.title">
    <code>{{ example.title }}</code>
    <label>
      program id
      <input v-model="example.program" spellcheck="false" autocomplete="off" />
    </label>
    <label v-if="example.seed !== undefined">
      static seed
      <input v-model="example.seed" spellcheck="false" autocomplete="off" />
    </label>
    <div v-if="example.signer !== undefined">
      <label>
        signer
        <input v-model="example.signer" placeholder="Paste a base58 public key" spellcheck="false" autocomplete="off" />
      </label>
      <button type="button" @click="generate(example)">Generate</button>
      <p v-if="keygenFailed">Ed25519 is not supported in this browser. Paste a public key instead.</p>
    </div>
    <output v-if="!example.result || example.signer === ''">…</output>
    <output v-else-if="'error' in example.result">{{ example.result.error }}</output>
    <output v-else>{{ example.result.pda }} (bump {{ example.result.bump }})</output>
  </section>
  <p>Example based on a <a href="https://plgrnd.io">PLGRND</a> flow.</p>
</template>`

export const nativePortGuide: MethodGuide = {
  tabs: [
    {
      id: 'react',
      label: 'React (@solana/kit)',
      platforms: ['Next.js', 'Docusaurus', 'Nextra', 'Fumadocs'],
      lang: 'tsx',
      file: 'app/components/previews/pda-seeds-widget.tsx',
    },
    {
      id: 'astro',
      label: 'Astro island',
      platforms: ['Astro', 'Starlight'],
      lang: 'astro',
      code: ASTRO_ISLAND,
    },
    {
      id: 'vue',
      label: 'Vue SFC',
      platforms: ['VitePress', 'Nuxt', 'Slidev'],
      lang: 'vue',
      code: VUE_SFC,
    },
  ],
  gotchas: [
    {
      id: 'credit-line',
      platform: 'All',
      issue: 'A port carries no PLGRND branding, so nothing on the page says where the flow comes from.',
      fix: 'Put `Example based on a [PLGRND](https://plgrnd.io) flow.` directly below the component: Markdown in MDX, a plain `<a>` in HTML, Astro or Vue.',
      evidence: 'PR/16.diff:352, PR/18.diff:23, PR/21.diff:115',
    },
    {
      id: 'ed25519-keygen',
      platform: 'Browsers without WebCrypto Ed25519',
      issue:
        '`generateKeyPair()` uses WebCrypto Ed25519, which some browsers do not support, so the signer example gets no key there.',
      fix: 'Catch the rejection and show `Ed25519 is not supported in this browser`, then let the reader paste a public key checked with `isAddress`. The examples without a signer need no key and keep working.',
      evidence: 'PR/16.diff:559-560',
    },
    {
      id: 'crypto-subtle-http',
      platform: 'Plain http (LAN IPs, dev servers)',
      issue:
        'WebCrypto needs a secure context. Over plain `http://` on anything but `localhost`, `crypto.subtle` is missing, so `getProgramDerivedAddress` (SHA-256) and `generateKeyPair` (Ed25519) both fail.',
      fix: 'Serve the docs over HTTPS or `localhost`, and show a readable error when `window.isSecureContext` is false instead of an empty result.',
      evidence: 'PR/20.diff:46-47',
    },
    {
      id: 'client-only',
      platform: 'Next.js, Astro',
      issue:
        'The port needs browser APIs and pulls in `@solana/kit`. `next/dynamic` with `ssr: false` is not allowed in Server Components or MDX, and an Astro component without a `client:*` directive renders HTML that never runs.',
      fix: "In Next.js, call `dynamic(() => import('./pda-seeds-widget'), { ssr: false })` in a separate `'use client'` file and import that file from MDX; this also keeps `@solana/kit` off other routes. In Astro, add `client:visible`.",
      evidence: 'PR/16.diff:367, PR/16.diff:350',
    },
    {
      id: 'fumadocs-md-to-mdx',
      platform: 'Fumadocs',
      issue: 'A `.md` page cannot import or render a component, so the port never shows up.',
      fix: 'Rename the page from `.md` to `.mdx`, then import the component at the top of it.',
      evidence: 'PR/18.diff:1-7',
    },
    {
      id: 'you-own-the-port',
      platform: 'All',
      issue:
        'A port re-implements the derivation in your codebase; some ship their own base58 and PDA code or a hand-written SHA-256. Fixes to PLGRND never reach that code.',
      fix: 'Use `@solana/kit` rather than hand-rolled crypto, pin its version, and keep a test that compares the port with the flow, for example `seeds = []` gives bump 253. Re-check it whenever the flow changes.',
      evidence: 'PR/21.diff:120-126, PR/20.diff:46-47',
    },
  ],
  requiredGotchaIds: [
    'credit-line',
    'ed25519-keygen',
    'crypto-subtle-http',
    'client-only',
    'fumadocs-md-to-mdx',
    'you-own-the-port',
  ],
}
