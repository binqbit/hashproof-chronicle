import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import path from "node:path";

export default defineConfig({
  server: { host: "127.0.0.1", port: 8080 },
  plugins: [
    react(),
    nodePolyfills({
      include: ["buffer"],
      globals: { Buffer: true, global: false, process: false },
    }),
  ],
  resolve: {
    alias: [
      { find: "@", replacement: path.resolve(__dirname, "src") },
      {
        find: /^crypto$/,
        replacement: path.resolve(__dirname, "src/contract/crypto-browser.ts"),
      },
    ],
    dedupe: ["@coral-xyz/anchor", "@solana/web3.js", "react", "react-dom"],
  },
  preview: { port: 4173, host: "127.0.0.1" },
});
