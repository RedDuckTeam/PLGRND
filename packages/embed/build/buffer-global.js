// esbuild `inject` source for the dev server's dependency pre-bundling: free `Buffer` references in
// dependencies (bip39 and friends) bind to the npm `buffer` package, as @rollup/plugin-inject does in builds.
export { Buffer } from 'buffer/'
