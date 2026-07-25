import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    // server/env.ts only accepts development|production; vitest defaults
    // NODE_ENV to "test", which would fail the fail-fast validation.
    env: { NODE_ENV: "development" },
    // The pure suites finish in milliseconds; the database ones talk to a
    // remote Neon instance over a websocket, and a job like runAnchorJob()
    // makes a round trip per epoch. 5s is a network measurement, not a
    // correctness one — 30s so a slow link fails no test.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
