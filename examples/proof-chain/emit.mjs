// Load the repository's TypeScript SDK without installing a separate TS runner.
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const server = await createServer({
  root: fileURLToPath(new URL("../../", import.meta.url)),
  configFile: false,
  server: { middlewareMode: true, watch: null },
});
try {
  const { generateArtifacts } = await server.ssrLoadModule(
    "/examples/proof-chain/generate.ts",
  );
  process.stdout.write(JSON.stringify(await generateArtifacts()));
} finally {
  await server.close();
}
