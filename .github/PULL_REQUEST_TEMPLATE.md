## What

<!-- Node name — one paragraph. Category: <existing category> — why. (Non-node PRs: describe the change.) -->

## Demo

<!-- Share link: https://plgrnd.io/#flow=…  and/or a screenshot -->

## Checklist (all required for node PRs — see CONTRIBUTING.md §7)

- [ ] **Build & pattern** — `yarn web:build` and `yarn workspace web lint` exit 0; `npx prettier --check` passes on every file you touched (`yarn format` fixes it); all nine registration points from §4 filled (the build proves 1–7; check 8–9 by hand).
- [ ] **Runtime** — node appears in the menu and renders; every new handle has `dataType` and incompatible targets dim while dragging an edge; the node survives a page reload and a Share → copy link → open round-trip (`data` is JSON-plain).
- [ ] **Embed** — open the flow via Share → Embed and check `mode=readonly`, `interactive`, `editor`; no wallet connection or transaction sending when embedded.
- [ ] **Docs & discoverability** — README "Node categories" row updated; tooltip entry in `node-tooltips.tsx`; a share link to a demo flow ready for the PR.

## Dependencies / external calls

<!-- none | <package or API> — why it is needed, size/impact, failure handling -->

## New `dataType`?

<!-- no | <name> — compatibility sets touched in utils/flow/connection.utils.ts -->
