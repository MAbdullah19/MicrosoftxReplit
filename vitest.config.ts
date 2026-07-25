import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    // server/env.ts only accepts development|production; vitest defaults
    // NODE_ENV to "test", which would fail the fail-fast validation.
    env: { NODE_ENV: "development" },
  },
});
