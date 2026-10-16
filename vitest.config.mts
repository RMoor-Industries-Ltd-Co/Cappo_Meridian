import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * First test tooling in this repo (CAPPO Milestone 5) — there was no
 * `vitest`/`jest` config or test file anywhere before this. Kept deliberately
 * minimal: Node environment (these are server-side lib/connector tests, no
 * DOM), the same `@/` → `src/` alias as tsconfig.json, and a `src/**` include
 * so vitest never picks up some other package's tests.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
