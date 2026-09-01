# Contributing to PLGRND — adding a node

This guide is for developers and companies who want to add their own node to PLGRND, either **upstream** (a PR to this repository — the node ships on [plgrnd.io](https://plgrnd.io)) or in **your own fork and deployment**. The technical steps are identical; only the last section differs.

Assumes TypeScript, React and Solana basics; none of them are explained here.

## 0. Quick facts

| Topic                | Value                                                                                                                                                                                                |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App                  | `apps/web` — React 19, Vite 7, `@xyflow/react` 12 (React Flow), Zustand, Tailwind 4                                                                                                                  |
| Install / run        | `yarn install` · `yarn web:dev`                                                                                                                                                                      |
| Verify               | `yarn web:build` (`tsc -b && vite build`) · `yarn workspace web lint` · `npx prettier --check <files you touched>` (`yarn format:check` scans the whole repo and may flag files you did not touch)   |
| Tests                | None. Verification is build + lint + the manual checklist in [§7](#7-verify-before-you-ship).                                                                                                        |
| Where nodes live     | `apps/web/src/{types/nodes,utils/node/data,components/nodes}/<category>/`                                                                                                                            |
| How nodes are wired  | Hand-edited registries: `types/node.ts`, `utils/node/node-config-registry.ts`, `utils/node/node-map.ts`, `utils/node/node-style.utils.ts`, `constants/menu-config.ts`, `constants/node-tooltips.tsx` |
| Caught by `tsc`      | Missing entries in `nodeConfigRegistry`, `nodeMap`, `nodeStyles` (all `Record<NodeType, …>`)                                                                                                         |
| **Not** caught       | Missing entries in `menuConfig` (node invisible), `NODE_TOOLTIPS` (no tooltip), README table                                                                                                         |
| Execution model      | No executor. Each node is a React component: it reads its inputs, computes, and writes its outputs into its own `data`; downstream nodes re-render.                                                  |
| Plugin / runtime API | None. Nodes are compiled into the bundle.                                                                                                                                                            |

All paths below are relative to `apps/web/src/` unless stated otherwise.

## 1. Do you need a node?

If your goal is "let people call **my Solana program** from PLGRND", you probably do not. Drop an **IDL** node (Programs category), paste your Anchor IDL, and the program's instructions and accounts become nodes (`PROGRAM_INSTRUCTIONS`, `PROGRAM_ACCOUNT`). No code, no PR.

Write a custom node when you need logic that is not an on-chain instruction: a derivation, an encoding, a lookup, a UI for a specific data shape.

## 2. Anatomy of a node

```
NodeTypeEnum.X ─┬─ types/nodes/<cat>/x-node.ts          XNodeData, XNodeType
                ├─ utils/node/data/<cat>/x-node-data.ts  xNodeConfig: label, handles, actions
                ├─ components/nodes/<cat>/x-node.tsx     <XNode/> wraps <CustomNode/>
                ├─ utils/node/node-config-registry.ts    [X]: xNodeConfig        (tsc)
                ├─ utils/node/node-map.ts                [X]: XNode              (tsc)
                ├─ utils/node/node-style.utils.ts        [X]: { color, width }   (tsc)
                ├─ constants/menu-config.ts              category.nodes.push(X)  (silent)
                └─ constants/node-tooltips.tsx           NODE_TOOLTIPS[X]        (silent)
```

| Piece                                                        | Type                                                                                                        | Notes                                                                                      |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `NodeConfig`                                                 | `{ label: string; handles: HandleConfig[]; actions: NodeActionConfigBase[] }`                               | Must be declared `as const satisfies NodeConfig` — input field names are inferred from it  |
| `HandleConfig`                                               | `{ position: Position; type: 'source' \| 'target'; dataField: string; dataType?; maxConnections?; label? }` | `dataField` is the key in `data` (source) or the input name (target)                       |
| `NodeActionConfigBase`                                       | `{ position: Position; label: string }`                                                                     | Rendered as a small button; wired with `useNodeActions`                                    |
| `CustomNode`                                                 | `components/ui/custom-node.tsx`                                                                             | Renders the colour strip, label, handles, actions and tooltip. Always wrap your JSX in it. |
| `useTypedNodesData<TargetFieldsForEnum<NodeTypeEnum.X>>(id)` | `hooks/flow/use-typed-nodes-data.ts`                                                                        | `{ [targetField]: { value, sourceId, sourceHandleId, dataField } }` for connected inputs   |
| `useTypedReactFlow().updateNodeData<XNodeData>(id, patch)`   | `hooks/flow/use-typed-react-flow.ts`                                                                        | Publishes outputs; keys must match source `dataField`s                                     |

## 3. Walkthrough: `Reverse String`

A pure node: one text in, one text out. Category `string`, id `STRING_REVERSE`, label `REVERSE`. It exists only to teach the pattern — delete it after you have followed the steps, or replace it with your real node.

**1. Enum** — `types/node.ts`, append at the end of `NodeTypeEnum` (order is cosmetic: `NodeType` is `keyof typeof NodeTypeEnum`):

```ts
  STRING_REVERSE = 'STRING_REVERSE',
```

**2. Data type** — new file `types/nodes/string/string-reverse-node.ts`:

```ts
import type { Node } from '@xyflow/react'
import type { NodeTypeEnum } from '../../node'

export type StringReverseNodeData = {
  reversed: string
}

export type StringReverseNodeType = Node<StringReverseNodeData, NodeTypeEnum.STRING_REVERSE>
```

**3. Config** — new file `utils/node/data/string/string-reverse-node-data.ts`:

```ts
import { Position } from '@xyflow/react'
import type { NodeConfig } from '@/types/node-config'

export const stringReverseNodeConfig = {
  label: 'REVERSE',
  handles: [
    { position: Position.Left, type: 'target', dataField: 'text', label: 'Text', dataType: 'text' },
    { position: Position.Right, type: 'source', dataField: 'reversed', label: 'Reversed', dataType: 'text' },
  ],
  actions: [],
} as const satisfies NodeConfig
```

**4. Config registry** — `utils/node/node-config-registry.ts` (do this before step 5: the component's input types are derived from the registry):

```ts
import { stringReverseNodeConfig } from './data/string/string-reverse-node-data'
// …
export const nodeConfigRegistry = {
  // …
  [NodeTypeEnum.STRING_REVERSE]: stringReverseNodeConfig,
} as const satisfies Record<NodeType, NodeConfig>
```

**5. Component** — new file `components/nodes/string/string-reverse-node.tsx`:

```tsx
import { useEffect, useMemo } from 'react'
import type { NodeProps } from '@xyflow/react'
import { CustomNode } from '../../ui/custom-node'
import { useTypedNodesData } from '@/hooks/flow/use-typed-nodes-data'
import { useTypedReactFlow } from '@/hooks/flow/use-typed-react-flow'
import type { NodeTypeEnum, TargetFieldsForEnum } from '@/types/node'
import type { StringReverseNodeData, StringReverseNodeType } from '@/types/nodes/string/string-reverse-node'
import { toText } from '@/utils/string/string-node.utils'
import { StringNodeContent, StringNodePreview } from './string-node-content'

export const StringReverseNode = (props: NodeProps<StringReverseNodeType>) => {
  const { updateNodeData } = useTypedReactFlow()
  const resolved = useTypedNodesData<TargetFieldsForEnum<NodeTypeEnum.STRING_REVERSE>>(props.id)

  const text = useMemo(() => toText(resolved.text?.value), [resolved])
  const reversed = useMemo(() => Array.from(text).reverse().join(''), [text])

  useEffect(() => {
    updateNodeData<StringReverseNodeData>(props.id, { reversed })
  }, [props.id, reversed, updateNodeData])

  return (
    <CustomNode {...props}>
      <StringNodeContent>
        <StringNodePreview value={reversed} />
      </StringNodeContent>
    </CustomNode>
  )
}
```

**6. Component map** — `utils/node/node-map.ts`:

```ts
import { StringReverseNode } from '@/components/nodes/string/string-reverse-node'
// …
export const nodeMap: Record<NodeType, React.ComponentType<any>> = {
  // …
  [NodeTypeEnum.STRING_REVERSE]: StringReverseNode,
}
```

**7. Style** — `utils/node/node-style.utils.ts` (colour = the category's colour, see the table in §5.4):

```ts
  [NodeTypeEnum.STRING_REVERSE]: { color: '#7a3f24', width: 180 },
```

**8. Menu** — `constants/menu-config.ts`, in the object with `id: 'string'`, append to `nodes`:

```ts
      NodeTypeEnum.STRING_REVERSE,
```

**9. Tooltip and README** — `constants/node-tooltips.tsx`, inside `NODE_TOOLTIPS` (optionally a docs URL in `NODE_TOOLTIP_LINKS`):

```tsx
  STRING_REVERSE: (
    <div>
      <p>Reverses the input text by Unicode code points.</p>
    </div>
  ),
```

…and add the node to the row of the **Node categories** table in the root `README.md` that covers your category (rows merge several categories, e.g. "Math / String / Logic").

Run `yarn web:dev`, open the menu → String → drag **REVERSE** onto the canvas, connect a **TEXT** node to its left handle, type something. Then run [§7](#7-verify-before-you-ship).

## 4. Registration checklist

| #   | File                                             | What                               | Forgot it?                    |
| --- | ------------------------------------------------ | ---------------------------------- | ----------------------------- |
| 1   | `types/node.ts`                                  | enum member                        | everything else fails to type |
| 2   | `types/nodes/<cat>/<name>-node.ts`               | `<Name>NodeData`, `<Name>NodeType` | tsc error                     |
| 3   | `utils/node/data/<cat>/<name>-node-data.ts`      | `<name>NodeConfig`                 | tsc error                     |
| 4   | `utils/node/node-config-registry.ts`             | registry entry                     | tsc error                     |
| 5   | `components/nodes/<cat>/<name>-node.tsx`         | `<Name>Node` component             | tsc error                     |
| 6   | `utils/node/node-map.ts`                         | map entry                          | tsc error                     |
| 7   | `utils/node/node-style.utils.ts`                 | `{ color, width }`                 | tsc error                     |
| 8   | `constants/menu-config.ts`                       | push into a category's `nodes`     | **silent** — node not in menu |
| 9   | `constants/node-tooltips.tsx` + root `README.md` | tooltip entry; table row           | **silent** — no tooltip / doc |

A missing entry in 4, 6 or 7 does not fail at that line. `TargetFieldsForEnum` is derived from the registry's key set, so one missing key produces dozens of `TS2344`/`TS2339` errors in unrelated node files. If the build explodes right after you added a node, check the three registries first.

## 5. Rules

### 5.1 Handles and `dataType`

- Handle DOM id is `${nodeId}-${dataField}-${position}` and is parsed by splitting on `-`. **`dataField` must not contain `-`.** Use camelCase. Nothing enforces this (`dataField` is a plain `string`): a dash fails silently at runtime — the input resolves to `undefined`.
- Every handle you add declares `dataType`. Compatibility is decided in `utils/flow/connection.utils.ts` (`areHandleTypesCompatible`): exact match, `any` on either side, or one of the compatibility sets — e.g. a `text` source may feed `text | publicKey | signature | privateKey | mint`, a `number` source may feed `number | uiAmount | decimals`. Existing types: `text`, `publicKey`, `signature`, `privateKey`, `mint`, `number`, `uiAmount`, `decimals`, `wallet`, `any`. An **untyped target** accepts anything; an untyped source connects only to `any`.
- Need a new type? Add it to the sets in `connection.utils.ts` and say so in the PR.
- `maxConnections` on a target limits fan-in; omit for unlimited.
- Handles are stacked per side, 12 px apart; keep `label` to one or two words.

### 5.2 `data` must be JSON-plain

`data` is persisted to `localStorage` and encoded into share URLs. On persist, `sanitizeForPersist` (`stores/flow-store.ts`) keeps primitives, arrays and plain objects and **drops class instances** (`PublicKey`, `Keypair`, `Transaction`, `Buffer`, `BN`, …). Store strings/numbers/booleans/plain objects; recompute derived values in the component. A new node starts with `data: {}` — tolerate missing fields.

### 5.3 Embed modes

Flows are embedded on third-party sites (`/embed`). `useFlowMode()` from `components/flow/flow-mode-context.ts` returns `{ mode: 'readonly' | 'interactive' | 'editor', embedded: boolean }`.

- `CustomNode` already hides actions in `readonly` and disables selection and double-click-to-Display outside `editor`.
- Your node must disable its own inputs/buttons when `mode === 'readonly'`.
- When `embedded`, never connect a wallet or send a transaction — deep-link to the editor instead (see `components/nodes/wallet/wallet-node.tsx`, `components/nodes/transactions/transaction-node.tsx`). Read-only RPC is fine.

### 5.4 Naming

| Thing                 | Convention                                                                                                                                                                                                                           | Example                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------- |
| Enum id               | `SCREAMING_SNAKE`                                                                                                                                                                                                                    | `STRING_REVERSE`              |
| Node `label`          | short UPPERCASE, ≤ ~14 chars (fits the strip)                                                                                                                                                                                        | `'REVERSE'`, `'PRIVATE KEY'`  |
| Handle / action label | Title Case                                                                                                                                                                                                                           | `'Public key'`, `'Generate'`  |
| `dataField`           | camelCase, no `-`                                                                                                                                                                                                                    | `balanceRaw`, `isValid`       |
| Files                 | `<name>-node.ts`, `<name>-node-data.ts`, `<name>-node.tsx` in the category folder                                                                                                                                                    | `string-reverse-node-data.ts` |
| Category              | one of the existing ten — `input` `#531d2b`, `math` `#3d4f91`, `logic` `#8a641f`, `utils` `#2f6f6a`, `transactions` `#2a5f2b`, `network` `#75511e`, `programs` `#5a1d5f`, `wallet` `#1f3d6b`, `crypto` `#265c75`, `string` `#7a3f24` | node colour = category colour |

Category means the menu group in `menu-config.ts`, not the folder or the name: `STRING_ENCODE`/`STRING_DECODE` live in `utils`. Pick by where a user would look in the menu. New categories are created by maintainers only; pick the closest existing one and explain the choice in the PR.

### 5.5 Persisted format — no compatibility promise

`nodes[].type` (your enum id), `nodes[].data` keys and the `dataField`s inside edge handle ids are stored in visitors' `localStorage` (`sol-learn:flow`, v3) and in every share link and embed. Renaming any of them breaks those flows silently. There is no migration layer and no compatibility promise — flows are educational and ephemeral — so prefer additive changes.

## 6. Advanced patterns

Reference nodes to copy from; no new abstractions needed.

| Pattern          | Where to look                                                                              | Gist                                                                                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Action buttons   | `utils/node/data/crypto/keypair-node-data.ts`, `components/nodes/network/balance-node.tsx` | `actions: [{ position, label }]` in config; in the component `const actions = useNodeActions(type, { Generate: fn })`; pass `actions` to `CustomNode` |
| Async / RPC      | `components/nodes/network/balance-node.tsx`, `hooks/solana/query/use-solana-balance.ts`    | TanStack Query hook keyed by inputs + a refresh counter; write results with `updateNodeData` when the query resolves                                  |
| Dynamic handles  | `hooks/nodes/use-program-instructions-node.ts`, `extraHandles` prop of `CustomNode`        | Compute `HandleConfig[]` from inputs, pass as `extraHandles`, call `useUpdateNodeInternals()(id)` after they change                                   |
| New `dataType`   | `utils/flow/connection.utils.ts`                                                           | Extend the compatibility sets; mention it in the PR                                                                                                   |
| Heavy dependency | `constants/solana/instructions-config.ts` (`await import('@solana/spl-token')`)            | Lazy-import inside the handler so the cold bundle (and embeds) stay small                                                                             |
| Shared string UI | `components/nodes/string/string-node-content.tsx`, `utils/string/string-node.utils.ts`     | `StringNodeContent`, `StringNodePreview`, `StringNodeRows`, `toText`, `toNumber`                                                                      |

## 7. Verify before you ship

All four groups are required — for upstream PRs and equally for your own fork.

> **Windows:** the repository is LF-only. With `core.autocrlf=true` every file is checked out as CRLF and `yarn format:check` fails before you have changed anything. Run `git config core.autocrlf false` (or `input`) before cloning, or renormalize with `git rm --cached -r . && git reset --hard`.

- [ ] **Build & pattern** — `yarn web:build` and `yarn workspace web lint` exit 0; `npx prettier --check` passes on every file you touched (`yarn format` fixes it); all nine registration points from §4 filled (the build proves 1–7; check 8–9 by hand).
- [ ] **Runtime** — node appears in the menu and renders; every new handle has `dataType` and incompatible targets dim while dragging an edge; the node survives a page reload and a Share → copy link → open round-trip (`data` is JSON-plain).
- [ ] **Embed** — open the flow via Share → Embed and check `mode=readonly`, `interactive`, `editor`; no wallet connection or transaction sending when embedded.
- [ ] **Docs & discoverability** — README "Node categories" row updated; tooltip entry in `node-tooltips.tsx`; a share link to a demo flow ready for the PR.

## 8. Final A — upstream pull request

1. Fork `RedDuckTeam/PLGRND`, branch from `main` (`feat/<name>-node`).
2. Run §7. Do not commit the throwaway `Reverse String` node.
3. Open a PR — the template is pre-filled. It must contain:
   1. what the node does, which **existing** category it goes into and why;
   2. a share link to a demo flow (and/or a screenshot);
   3. the ticked checklist from §7;
   4. a justification for **every** new dependency or external (non-RPC) HTTP call — size, purpose, failure handling. There is no fixed rule; maintainers decide case by case. Prefer lazy imports;
   5. a note if you added a `dataType`.
4. Review is done by the RedDuck team, without an SLA. A green checklist is necessary, not sufficient: a node can be declined for product reasons (overlap, scope, maintenance cost).

## 9. Final B — your own instance

Same steps 1–9 and §7, no PR. To ship:

```bash
yarn install
yarn web:build                 # apps/web/dist
yarn workspace web deploy      # Cloudflare Workers via wrangler (apps/web/wrangler.jsonc)
# …or host apps/web/dist on any static host with SPA fallback
```

Set `VITE_PUBLIC_SOLANA_RPC` to your RPC endpoint (see `apps/web/src/env.ts`). Keeping up with upstream is ordinary `git fetch`/`merge` — the registries are the usual conflict points, and there is no promise of API stability.

## 10. Policies

- **License.** By opening a PR you agree your contribution is licensed under the project's [MIT license](LICENSE). No CLA, no DCO.
- **Branding.** Protocol or company names are fine in `label`, tooltips and `NODE_TOOLTIP_LINKS` (`'JUPITER QUOTE'`). Logos, custom colours and marketing copy are not.
- **Categories.** Existing ten only; new ones are a maintainer decision.
- **Dependencies / external APIs.** Justified in the PR, decided case by case.
- **Compatibility.** None promised; see §5.5.
- **Review.** RedDuck team, no SLA, product-level rejection possible.

## 11. Not covered (yet)

A runtime plugin API, a node generator (`yarn node:new`) and single-file co-located node definitions are future work.
