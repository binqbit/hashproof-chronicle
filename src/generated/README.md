# Generated contract integration

`hash-timestamp/app/sdk/` is copied from the submodule SDK. The sync script adds
one explicit missing-`rentEpoch` guard for modern web3.js RPC types. All hashing,
PDA derivation, encoding and instruction builders remain upstream implementations.
`hash-timestamp/idl.json` and `target/types/hash_timestamp.ts` are generated from
the reviewed IDL using Anchor's converter. Do not edit these files manually.

Run `npm run sync:sdk`, `npm run sync:idl`, or `npm run sync:contract`.
`npm run check:contract` detects drift without writing files or updating Git.

Application code imports `src/contract/sdk.ts`. Vite maps the SDK's synchronous
Node `crypto` SHA-256 calls to `src/contract/crypto-browser.ts`; Buffer is supplied
by the browser build. Do not hand-edit managed copies: adapt the sync script or
the browser boundary, document the change and add a compatibility test.
