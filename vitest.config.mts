import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
    environment: "node",
    pool: "forks", // PGlite (WASM) is more reliable in child processes than worker threads
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
