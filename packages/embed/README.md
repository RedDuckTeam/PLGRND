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
- **Transactions.** Since 1.1.0, `tx` shows a transaction as a live, decoded flow instead of a saved `flow`: a signature, or a serialized transaction in base64 or base58 (simulated). `cluster` (`mainnet` or `devnet`) says where to look; unset, a signature is looked up on mainnet, then devnet. The import reads only your RPC endpoints (`rpc-mainnet`, `rpc-devnet`), and `flow` wins when both are set:

  ```html
  <plgrnd-flow tx="5Kj…" cluster="mainnet" rpc-mainnet="https://…" style="display:block;height:480px"></plgrnd-flow>
  ```

- **SSR.** On the server, the import is an empty module (the `node` export condition).
- **Types.** TypeScript types cover `<plgrnd-flow>` in React 18 and 19 JSX.
- **Classic script.** `@plgrnd/embed/iife` is the single-file build (`dist/plgrnd-flow.iife.js`). Versioned downloads with checksums are at `https://plgrnd.io/sdk/<version>/`.

The full documentation covers attributes, theming, RPC, CSP, recipes for Mintlify, Docusaurus, MkDocs Material, Next.js/Fumadocs and Markdoc, and the limits. It is in the repository README: [Self-hosted embedding](https://github.com/RedDuckTeam/PLGRND#self-hosted-embedding).

## License

MIT. The licences of the bundled third-party packages are in `dist/THIRD_PARTY_LICENSES.txt`.
