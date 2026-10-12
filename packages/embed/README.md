# @plgrnd/embed

`<plgrnd-flow>` puts an interactive [PLGRND](https://plgrnd.io) flow on your documentation site. It is a custom element with Shadow DOM: no iframe, and nothing loaded from plgrnd.io. At runtime it talks only to the Solana RPC endpoints you configure.

```sh
npm install @plgrnd/embed
```

```js
import '@plgrnd/embed' // registers <plgrnd-flow>; the runtime loads when the first element connects
```

```html
<plgrnd-flow flow="N4Ig…" theme="auto" style="display:block;aspect-ratio:16/9;min-height:320px"></plgrnd-flow>
```

- **Snippet.** Get one from PLGRND's **Share → Embed → Self-hosted**, in HTML, MDX, Mintlify or Markdoc.
- **SSR.** On the server, the import is an empty module (the `node` export condition).
- **Types.** TypeScript types cover `<plgrnd-flow>` in React 18 and 19 JSX.
- **Classic script.** `@plgrnd/embed/iife` is the single-file build (`dist/plgrnd-flow.iife.js`). Versioned downloads with checksums are at `https://plgrnd.io/sdk/<version>/`.

The full documentation covers attributes, theming, RPC, CSP, recipes for Mintlify, Docusaurus, MkDocs Material, Next.js/Fumadocs and Markdoc, and the limits. It is in the repository README: [Self-hosted embedding](https://github.com/RedDuckTeam/PLGRND#self-hosted-embedding).

## License

MIT. The licences of the bundled third-party packages are in `dist/THIRD_PARTY_LICENSES.txt`.
