# HashProof Chronicle

## Overview
HashProof Chronicle is a Solana web application for anchoring and verifying 32-byte file hashes through the HashTimestamp on-chain program. End users can drag and drop files, confirm existing proofs, and create new entries with their wallet.

## HashTimestamp Program
The UI talks to the HashTimestamp program, which stores the first-seen timestamp and vote counts for each hash in a Solana account.
- [Hash Timestamp Program](https://github.com/binqbit/hash-timestamp)

## Installation
1. Clone this repository.
2. Install dependencies:
   ```sh
   npm install
   ```

## Running the Application
Launch the Vite development server:

```sh
npm run dev
```

## Building and Serving
Create a production build and serve it with the same `serve` workflow used in deployment pipelines:

```sh
npm run build
npx serve -s dist -l 3000
```

The generated `dist/` directory can be hosted on any static site provider with SPA fallback to `index.html`.
