import { defineConfig } from "vitest/config";
import base from "./vitest.config";

export default defineConfig({
  ...base,
  test: {
    ...base.test,
    include: ["tests/localnet/**/*.test.ts"],
    testTimeout: 120_000,
  },
});
